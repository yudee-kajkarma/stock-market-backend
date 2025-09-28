const express = require("express");
const WebSocket = require("ws").WebSocket;
const protobuf = require("protobufjs");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

let protobufRoot = null;
let wsConnection = null;
let marketData = {}; // Store latest market data

// Replace with your actual access token
const accessToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGQ5NTk3YzcyOGJjMjdkMmFjY2JkZmMiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTA3NDY4NCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5MDk2ODAwfQ.rZKsl0HuQgWtZ13J1D3MRViaVwyrkR07mcGx5A-B4Hk";

// Initialize protobuf
const initProtobuf = async () => {
  try {
    protobufRoot = await protobuf.load(__dirname + "/MarketDataFeedV3.proto");
    console.log("✅ Protobuf initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize protobuf:", error);
  }
};

// Decode protobuf messages
const decodeProtobuf = (buffer) => {
  if (!protobufRoot) {
    console.warn("⚠️ Protobuf not initialized");
    return null;
  }
  
  try {
    const FeedResponse = protobufRoot.lookupType(
      "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
    );
    const decoded = FeedResponse.decode(buffer);
    return FeedResponse.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String
    });
  } catch (error) {
    console.error("❌ Failed to decode protobuf:", error);
    return null;
  }
};

// Get WebSocket feed URL
const getMarketFeedUrl = async () => {
  try {
    const url = "https://api.upstox.com/v3/feed/market-data-feed/authorize";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    const response = await axios.get(url, { headers });
    console.log("✅ Got WebSocket URL");
    return response.data.data.authorizedRedirectUri;
  } catch (error) {
    console.error("❌ Failed to get WebSocket URL:", error);
    throw error;
  }
};

// Connect WebSocket
const connectWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    console.log("🔄 Connecting to WebSocket...");
    const ws = new WebSocket(wsUrl, { 
      followRedirects: true,
      headers: {
        'User-Agent': 'Node.js WebSocket Client'
      }
    });

    let pingInterval;

    ws.on("open", () => {
      console.log("✅ WebSocket connected successfully");
      
      // Send subscription message
      const subscriptionData = {
        guid: "someguid",
        method: "sub",
        data: {
          mode: "full",
          // instrumentKeys: ["NSE_INDEX|Nifty Bank", "NSE_INDEX|Nifty 50"],
          instrumentKeys: ["FUT"],
        },
      };
      
      console.log("📡 Sending subscription:", JSON.stringify(subscriptionData));
      ws.send(JSON.stringify(subscriptionData));
      
      // Set up ping to keep connection alive
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);
      
      resolve(ws);
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 WebSocket disconnected - Code: ${code}, Reason: ${reason}`);
      if (pingInterval) clearInterval(pingInterval);
      wsConnection = null;
    });

    ws.on("message", (data) => {
      try {
        console.log("📨 Raw message received, length:", data.length);
        
        // Try to decode as JSON first (for acknowledgments)
        if (data[0] === 123) { // Check if starts with '{'
          try {
            const jsonData = JSON.parse(data.toString());
            console.log("📋 JSON Response:", jsonData);
            return;
          } catch (e) {
            // Not JSON, continue with protobuf decode
          }
        }
        
        // Decode protobuf
        const decoded = decodeProtobuf(data);
        if (decoded) {
          console.log("📊 Decoded Market Data:", JSON.stringify(decoded, null, 2));
          
          // Store latest data
          if (decoded.feeds) {
            Object.keys(decoded.feeds).forEach(key => {
              marketData[key] = {
                ...decoded.feeds[key],
                timestamp: new Date().toISOString()
              };
            });
          }
          
          // Broadcast to frontend clients
          io.emit('marketData', decoded);
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
      if (pingInterval) clearInterval(pingInterval);
      reject(error);
    });

    ws.on("ping", () => {
      console.log("🏓 Received ping");
      ws.pong();
    });

    ws.on("pong", () => {
      console.log("🏓 Received pong");
    });

    // Timeout after 10 seconds if connection doesn't open
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("⏰ Connection timeout");
        ws.terminate();
        reject(new Error("Connection timeout"));
      }
    }, 10000);
  });
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 Frontend client connected:', socket.id);
  
  // Send current market data to new client
  socket.emit('marketData', marketData);
  
  socket.on('disconnect', () => {
    console.log('👤 Frontend client disconnected:', socket.id);
  });
});

// API Routes
app.get("/start-feed", async (req, res) => {
  try {
    if (!wsConnection) {
      console.log("🚀 Starting WebSocket feed...");
      const wsUrl = await getMarketFeedUrl();
      wsConnection = await connectWebSocket(wsUrl);
      
      const successMessage = "WebSocket feed started and subscribed to Nifty Bank & Nifty 50!";
      console.log("✅", successMessage);
      res.json({ 
        success: true, 
        message: successMessage,
        status: "connected"
      });
    } else {
      const alreadyRunningMessage = "WebSocket already running";
      console.log("⚠️", alreadyRunningMessage);
      res.json({ 
        success: true, 
        message: alreadyRunningMessage,
        status: "already_connected"
      });
    }
  } catch (err) {
    console.error("❌ Failed to start WebSocket feed:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to start WebSocket feed",
      error: err.message
    });
  }
});

app.get("/stop-feed", (req, res) => {
  try {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
      const message = "WebSocket feed stopped";
      console.log("🛑", message);
      res.json({ success: true, message, status: "disconnected" });
    } else {
      const message = "No active WebSocket connection";
      console.log("⚠️", message);
      res.json({ success: false, message, status: "not_connected" });
    }
  } catch (err) {
    console.error("❌ Error stopping feed:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error stopping feed",
      error: err.message 
    });
  }
});

app.get("/status", (req, res) => {
  const status = {
    connected: wsConnection ? wsConnection.readyState === WebSocket.OPEN : false,
    protobufInitialized: protobufRoot !== null,
    latestData: marketData
  };
  res.json(status);
});

app.get("/latest-data", (req, res) => {
  res.json(marketData);
});

// Serve a simple frontend
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Market Data Feed</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            button { padding: 10px 20px; margin: 5px; cursor: pointer; }
            .data-container { margin-top: 20px; }
            .data-item { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; }
            pre { background: #f8f9fa; padding: 15px; overflow-x: auto; white-space: pre-wrap; }
        </style>
        <script src="/socket.io/socket.io.js"></script>
    </head>
    <body>
        <div class="container">
            <h1>Market Data Feed Monitor</h1>
            
            <div id="status" class="status disconnected">
                Status: Disconnected
            </div>
            
            <div>
                <button onclick="startFeed()">Start Feed</button>
                <button onclick="stopFeed()">Stop Feed</button>
                <button onclick="checkStatus()">Check Status</button>
                <button onclick="clearData()">Clear Data</button>
            </div>
            
            <div class="data-container">
                <h2>Live Market Data:</h2>
                <div id="marketData">No data received yet...</div>
            </div>
        </div>

        <script>
            const socket = io();
            
            socket.on('connect', () => {
                console.log('Connected to server');
                updateStatus('Connected to server', true);
            });
            
            socket.on('marketData', (data) => {
                console.log('Market data received:', data);
                displayMarketData(data);
            });
            
            socket.on('disconnect', () => {
                console.log('Disconnected from server');
                updateStatus('Disconnected from server', false);
            });
            
            function updateStatus(message, connected) {
                const statusEl = document.getElementById('status');
                statusEl.textContent = \`Status: \${message}\`;
                statusEl.className = \`status \${connected ? 'connected' : 'disconnected'}\`;
            }
            
            function displayMarketData(data) {
                const container = document.getElementById('marketData');
                const timestamp = new Date().toLocaleTimeString();
                container.innerHTML = \`
                    <div class="data-item">
                        <strong>Last Update:</strong> \${timestamp}<br>
                        <pre>\${JSON.stringify(data, null, 2)}</pre>
                    </div>
                \`;
            }
            
            async function startFeed() {
                try {
                    const response = await fetch('/start-feed');
                    const data = await response.json();
                    alert(data.message);
                } catch (error) {
                    alert('Error starting feed: ' + error.message);
                }
            }
            
            async function stopFeed() {
                try {
                    const response = await fetch('/stop-feed');
                    const data = await response.json();
                    alert(data.message);
                } catch (error) {
                    alert('Error stopping feed: ' + error.message);
                }
            }
            
            async function checkStatus() {
                try {
                    const response = await fetch('/status');
                    const data = await response.json();
                    alert(JSON.stringify(data, null, 2));
                } catch (error) {
                    alert('Error checking status: ' + error.message);
                }
            }
            
            function clearData() {
                document.getElementById('marketData').innerHTML = 'No data received yet...';
            }
        </script>
    </body>
    </html>
  `);
});

// Start server
server.listen(PORT, async () => {
  await initProtobuf();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Market data will be displayed at http://localhost:${PORT}`);
});