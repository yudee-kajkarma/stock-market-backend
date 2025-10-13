// Options Data Testing - Isolated Test Environment
require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws").WebSocket;
const protobuf = require("protobufjs");
const axios = require("axios");
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');

// Setup Express and Socket.io for testing
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For testing only
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.TEST_PORT || 3000;

// Enable CORS for REST API
app.use(cors());
app.use(express.json());

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://juisueefqgtvzezrzudv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aXN1ZWVmcWd0dnplenJ6dWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDUzNTcsImV4cCI6MjA3NDc4MTM1N30.zFzHnvlX5cyk7TfbOUZ1zB_depLTNWEzXmhDbcVlXYI";

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials are missing. Please check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize global variables for options testing
let protobufRoot = null;
let optionsWs = null;
let cachedAccessToken = null;
let tokenCacheTime = null;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get access token from Supabase
const getAccessTokenFromDB = async () => {
  try {
    // Check if we have a cached token that's still valid
    if (cachedAccessToken && tokenCacheTime && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
      console.log('🔄 [OPTIONS TEST] Using cached access token');
      return cachedAccessToken;
    }

    console.log('🔍 [OPTIONS TEST] Fetching access token from database...');
    
    const { data, error } = await supabase
      .from('access_tokens')
      .select('token, expires_at')
      .eq('provider', 'upstox')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('❌ [OPTIONS TEST] Error fetching access token:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No active access token found in database');
    }

    // Check if token is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new Error('Access token has expired');
    }

    // Cache the token
    cachedAccessToken = data.token;
    tokenCacheTime = Date.now();
    
    console.log('✅ [OPTIONS TEST] Successfully fetched access token from database');
    return data.token;
  } catch (error) {
    console.error('❌ [OPTIONS TEST] Failed to get access token:', error.message);
    throw error;
  }
};

// Function to get available instruments for testing
const getTestInstruments = async () => {
  try {
    const accessToken = await getAccessTokenFromDB();
    const url = "https://api.upstox.com/v3/instrument/search";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    
    console.log('🔍 [OPTIONS TEST] Fetching available instruments...');
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.data) {
      // Filter for options instruments
      const optionsInstruments = response.data.data.filter(instrument => 
        instrument.segment === 'NSE_FO' && 
        instrument.name.includes('NIFTY') &&
        (instrument.name.includes('CE') || instrument.name.includes('PE'))
      ).slice(0, 10); // Get first 10 options
      
      console.log('✅ [OPTIONS TEST] Found options instruments:', optionsInstruments.length);
      return optionsInstruments.map(inst => `${inst.exchange}|${inst.instrument_token}`);
    }
    
    return [];
  } catch (error) {
    console.error('❌ [OPTIONS TEST] Failed to fetch instruments:', error.message);
    // Return fallback instruments
    return [
        "NSE_FO|59313"
    ];
  }
};

// Function to authorize the market data feed for options
const getMarketFeedUrl = async () => {
  try {
    const accessToken = await getAccessTokenFromDB();
    const url = "https://api.upstox.com/v3/feed/market-data-feed/authorize";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    
    console.log('🔐 [OPTIONS TEST] Authorizing market data feed...');
    const response = await axios.get(url, { headers });
    console.log('✅ [OPTIONS TEST] Successfully authorized market data feed');
    
    return response.data.data.authorizedRedirectUri;
  } catch (error) {
    console.error('❌ [OPTIONS TEST] Failed to authorize market data feed:', error.message);
    throw error;
  }
};

// Function to initialize protobuf
const initProtobuf = async () => {
  try {
    protobufRoot = await protobuf.load(__dirname + "/MarketDataFeedV3.proto");
    console.log("✅ [OPTIONS TEST] Protobuf initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ [OPTIONS TEST] Failed to initialize protobuf:", error);
    return false;
  }
};

// Function to decode protobuf message
const decodeProfobuf = (buffer) => {
  if (!protobufRoot) {
    console.warn("⚠️ [OPTIONS TEST] Protobuf not initialized yet!");
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
      bytes: String,
    });
  } catch (error) {
    console.error("❌ [OPTIONS TEST] Failed to decode protobuf:", error);
    return null;
  }
};

// Function to establish WebSocket connection for options data
const connectOptionsWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      followRedirects: true,
    });

    // WebSocket event handlers for options
    ws.on("open", () => {
      console.log("✅ [OPTIONS TEST] Connected to Upstox Options WebSocket");
      resolve(ws);

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log("💓 [OPTIONS TEST] Sending heartbeat ping");
          ws.ping();
        } else {
          clearInterval(heartbeat);
        }
      }, 30000); // Every 30 seconds

      // Try multiple subscription attempts with different modes and instruments
      setTimeout(() => {
        // First try with LTPC mode for basic connectivity test
        const ltpcTest = {
          guid: "ltpc_test_" + Date.now(),
          method: "sub",
          data: {
            mode: "full",
            instrumentKeys: [
              // "NSE_INDEX|Nifty 50", // Known working instrument
              // "NSE_INDEX|Nifty Bank" // Another known working instrument
            ],
          },
        };
        
        console.log("📡 [OPTIONS TEST] Sending LTPC test subscription:", JSON.stringify(ltpcTest, null, 2));
        ws.send(Buffer.from(JSON.stringify(ltpcTest)));
        
        // Then try option instruments with option_greeks mode
        setTimeout(() => {
          const optionGreeksTest = {
            guid: "options_greeks_" + Date.now(),
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: [
                // "NSE_FO|45450", // Nifty options
                // "NSE_FO|45451", // Nifty options
                // "NSE_FO|50904", // Bank Nifty options
                "NSE_FO|50923", // Bank Nifty options
                // "NSE_FO|60907"  // Another option
              ],
            },
          };
          
          console.log("📡 [OPTIONS TEST] Sending option Greeks subscription:", JSON.stringify(optionGreeksTest, null, 2));
          ws.send(Buffer.from(JSON.stringify(optionGreeksTest)));
        }, 2000);

        // Also try full mode for comparison
        setTimeout(() => {
          const fullModeTest = {
            guid: "options_full_" + Date.now(),
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: [
                "NSE_FO|45450",
                "NSE_FO|50904"
              ],
            },
          };
          
          console.log("📡 [OPTIONS TEST] Sending full mode subscription:", JSON.stringify(fullModeTest, null, 2));
          ws.send(Buffer.from(JSON.stringify(fullModeTest)));
        }, 4000);
      }, 1000);
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 [OPTIONS TEST] Disconnected from Options WebSocket. Code: ${code}, Reason: ${reason}`);
      optionsWs = null;
    });

    ws.on("message", (data) => {
      try {
        console.log("📥 [OPTIONS TEST] Raw message received, size:", data.length, "bytes");
        console.log("📥 [OPTIONS TEST] Raw data (first 100 bytes):", data.slice(0, 100).toString('hex'));
        
        // Decode the protobuf message
        const decoded = decodeProfobuf(data);

        if (decoded) {
          console.log("🔍 [OPTIONS TEST] Decoded options data:");
          console.log(JSON.stringify(decoded, null, 2));

          // Send to Socket.IO clients
          io.emit("optionsTestData", {
            timestamp: Date.now(),
            data: decoded
          });

          // Extract and process Option Greeks data
          if (decoded.feeds) {
            const optionGreeksData = {};
            let foundGreeks = false;

            Object.keys(decoded.feeds).forEach((key) => {
              const feed = decoded.feeds[key];
              
              console.log(`📊 [OPTIONS TEST] Processing feed for instrument ${key}:`);
              console.log(JSON.stringify(feed, null, 2));

              // Parse according to protobuf structure
              let optionGreeks = null;
              let ltp = null;
              let vtt = null;
              let oi = null;
              let iv = null;

              // Check for firstLevelWithGreeks structure (option_greeks mode)
              if (feed.firstLevelWithGreeks) {
                const flwg = feed.firstLevelWithGreeks;
                optionGreeks = flwg.optionGreeks;
                ltp = flwg.ltpc ? flwg.ltpc.ltp : null;
                vtt = flwg.vtt;
                oi = flwg.oi;
                iv = flwg.iv;
                
                console.log(`📋 [OPTIONS TEST] Found firstLevelWithGreeks structure for ${key}`);
              }
              // Check for fullFeed structure (full mode)
              else if (feed.fullFeed && feed.fullFeed.marketFF) {
                const marketFF = feed.fullFeed.marketFF;
                optionGreeks = marketFF.optionGreeks;
                ltp = marketFF.ltpc ? marketFF.ltpc.ltp : null;
                vtt = marketFF.vtt;
                oi = marketFF.oi;
                iv = marketFF.iv;
                
                console.log(`📋 [OPTIONS TEST] Found fullFeed.marketFF structure for ${key}`);
              }
              // Check for direct LTPC structure
              else if (feed.ltpc) {
                ltp = feed.ltpc.ltp;
                console.log(`📋 [OPTIONS TEST] Found LTPC only structure for ${key}`);
              }

              if (optionGreeks) {
                foundGreeks = true;
                optionGreeksData[key] = {
                  delta: optionGreeks.delta || 0,
                  gamma: optionGreeks.gamma || 0,
                  theta: optionGreeks.theta || 0,
                  vega: optionGreeks.vega || 0,
                  rho: optionGreeks.rho || 0,
                  iv: iv || 0, // Implied Volatility
                  ltp: ltp || 0,
                  vtt: vtt || 0, // Volume traded today
                  oi: oi || 0, // Open Interest
                  timestamp: decoded.currentTs || Date.now()
                };
                
                console.log(`✅ [OPTIONS TEST] Found Greeks for ${key}:`, optionGreeksData[key]);
              } else if (ltp) {
                // Even if no Greeks, capture the LTP data
                optionGreeksData[key] = {
                  ltp: ltp,
                  vtt: vtt || 0,
                  oi: oi || 0,
                  iv: iv || 0,
                  timestamp: decoded.currentTs || Date.now(),
                  note: "LTP only - no Greeks available"
                };
                console.log(`📊 [OPTIONS TEST] Found LTP data for ${key}:`, optionGreeksData[key]);
              } else {
                console.log(`❌ [OPTIONS TEST] No Greeks or LTP found for ${key}`);
                console.log(`Available fields:`, Object.keys(feed));
                
                // Log the feed structure for debugging
                if (feed.requestMode !== undefined) {
                  console.log(`Request mode: ${feed.requestMode}`);
                }
              }
            });

            if (foundGreeks || Object.keys(optionGreeksData).length > 0) {
              console.log("📈 [OPTIONS TEST] Emitting option data:", optionGreeksData);
              io.emit("optionGreeksTest", { 
                timestamp: Date.now(), 
                data: optionGreeksData 
              });
            } else {
              console.log("⚠️ [OPTIONS TEST] No option data found in any feed");
            }
          } else {
            console.log("⚠️ [OPTIONS TEST] No feeds found in decoded data");
          }
        } else {
          console.log("❌ [OPTIONS TEST] Failed to decode message");
        }
      } catch (error) {
        console.error("❌ [OPTIONS TEST] Error processing options message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ [OPTIONS TEST] WebSocket error:", error);
      reject(error);
    });

    ws.on("ping", () => {
      console.log("🏓 [OPTIONS TEST] Received ping from server");
    });

    ws.on("pong", () => {
      console.log("🏓 [OPTIONS TEST] Received pong from server");
    });
  });
};

// Socket.IO connection handling for testing
io.on("connection", (socket) => {
  console.log("👤 [OPTIONS TEST] Test client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("👤 [OPTIONS TEST] Test client disconnected:", socket.id);
  });

  // Handle test subscription requests
  socket.on("testSubscribe", async (instruments) => {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      socket.emit("error", { message: "Options WebSocket not connected" });
      return;
    }

    try {
      const data = {
        guid: "clienttest_" + Date.now(),
        method: "sub",
        data: {
          mode: "option_greeks",
          instrumentKeys: Array.isArray(instruments) ? instruments : [
            "NSE_FO|45450", // Nifty Call Option
            "NSE_FO|45451", // Nifty Put Option  
            "NSE_FO|50904", // Bank Nifty Call Option
            "NSE_FO|50923"  // Bank Nifty Put Option
          ],
        },
      };

      console.log("📡 [OPTIONS TEST] Client requested subscription:", JSON.stringify(data, null, 2));
      optionsWs.send(Buffer.from(JSON.stringify(data)));
      socket.emit("testSubscribed", { instruments: data.data.instrumentKeys });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to send test subscription: " + error.message,
      });
    }
  });
});

// API Routes for testing
app.get("/test/start", async (req, res) => {
  try {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      console.log("🚀 [OPTIONS TEST] Starting Options WebSocket connection...");
      const wsUrl = await getMarketFeedUrl();
      optionsWs = await connectOptionsWebSocket(wsUrl);
      res.json({ success: true, message: "Options WebSocket test connection started" });
    } else {
      res.json({ success: true, message: "Options WebSocket already connected" });
    }
  } catch (error) {
    console.error("❌ [OPTIONS TEST] Failed to start WebSocket:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/test/status", (req, res) => {
  res.json({
    success: true,
    data: {
      optionsConnected: optionsWs && optionsWs.readyState === WebSocket.OPEN,
      connectionState: optionsWs ? optionsWs.readyState : null,
      protobufInitialized: protobufRoot !== null,
      connectedClients: io.engine.clientsCount,
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/test/instruments", async (req, res) => {
  try {
    const instruments = await getTestInstruments();
    res.json({
      success: true,
      data: {
        instruments: instruments,
        count: instruments.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch instruments",
      details: error.message
    });
  }
});

app.post("/test/subscribe", async (req, res) => {
  try {
    const { instrumentKeys, mode = "option_greeks" } = req.body;

    if (!instrumentKeys || !Array.isArray(instrumentKeys)) {
      return res.status(400).json({ 
        success: false, 
        error: "instrumentKeys array is required" 
      });
    }

    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      return res.status(400).json({ 
        success: false, 
        error: "Options WebSocket not connected. Call /test/start first." 
      });
    }

    const data = {
      guid: "manual_test_" + Date.now(),
      method: "sub",
      data: {
        mode: mode,
        instrumentKeys: instrumentKeys,
      },
    };

    console.log("📡 [OPTIONS TEST] Manual subscription:", JSON.stringify(data, null, 2));
    optionsWs.send(Buffer.from(JSON.stringify(data)));
    
    res.json({ 
      success: true, 
      message: "Test subscription sent successfully",
      data: {
        instrumentKeys: instrumentKeys,
        mode: mode,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to send test subscription",
      details: error.message 
    });
  }
});

// Simple HTML test page
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Options Data Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            .data-box { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: #f9f9f9; }
            pre { background: #f4f4f4; padding: 10px; overflow-x: auto; border-radius: 3px; }
            button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            .btn-primary { background-color: #007bff; color: white; }
            .btn-success { background-color: #28a745; color: white; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Options Data Test Environment</h1>
            
            <div id="status" class="status disconnected">
                Status: Disconnected
            </div>
            
            <div>
                <button onclick="startConnection()" class="btn-primary">Start Options Connection</button>
                <button onclick="checkStatus()" class="btn-success">Check Status</button>
                <button onclick="testSubscribe()" class="btn-success">Test Subscribe</button>
                <button onclick="fetchInstruments()" class="btn-success">Fetch Real Instruments</button>
            </div>
            
            <div class="data-box">
                <h3>Available Instruments:</h3>
                <pre id="instrumentsData">Click "Fetch Real Instruments" to load...</pre>
            </div>
            
            <div class="data-box">
                <h3>Raw Options Data:</h3>
                <pre id="rawData">Waiting for data...</pre>
            </div>
            
            <div class="data-box">
                <h3>Option Greeks Data:</h3>
                <pre id="greeksData">Waiting for Greeks data...</pre>
            </div>
            
            <div class="data-box">
                <h3>Connection Log:</h3>
                <pre id="log">Ready to start testing...</pre>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            
            function log(message) {
                const logElement = document.getElementById('log');
                const timestamp = new Date().toLocaleTimeString();
                logElement.textContent += \`[\${timestamp}] \${message}\\n\`;
                logElement.scrollTop = logElement.scrollHeight;
            }
            
            socket.on('connect', () => {
                log('Connected to test server');
            });
            
            socket.on('optionsTestData', (data) => {
                document.getElementById('rawData').textContent = JSON.stringify(data, null, 2);
                log('Received raw options data');
            });
            
            socket.on('optionGreeksTest', (data) => {
                document.getElementById('greeksData').textContent = JSON.stringify(data, null, 2);
                log('Received option Greeks data: ' + Object.keys(data.data).length + ' instruments');
            });
            
            socket.on('error', (error) => {
                log('Error: ' + error.message);
            });
            
            async function startConnection() {
                try {
                    const response = await fetch('/test/start');
                    const result = await response.json();
                    log(result.message);
                    setTimeout(checkStatus, 1000);
                } catch (error) {
                    log('Failed to start connection: ' + error.message);
                }
            }
            
            async function checkStatus() {
                try {
                    const response = await fetch('/test/status');
                    const result = await response.json();
                    const statusElement = document.getElementById('status');
                    
                    if (result.data.optionsConnected) {
                        statusElement.className = 'status connected';
                        statusElement.textContent = 'Status: Connected (' + result.data.connectedClients + ' clients)';
                    } else {
                        statusElement.className = 'status disconnected';
                        statusElement.textContent = 'Status: Disconnected';
                    }
                    
                    log('Status checked - Connected: ' + result.data.optionsConnected);
                } catch (error) {
                    log('Failed to check status: ' + error.message);
                }
            }
            
            async function fetchInstruments() {
                try {
                    const response = await fetch('/test/instruments');
                    const result = await response.json();
                    
                    if (result.success) {
                        document.getElementById('instrumentsData').textContent = JSON.stringify(result.data, null, 2);
                        log('Fetched ' + result.data.count + ' real instruments');
                    } else {
                        log('Failed to fetch instruments: ' + result.error);
                    }
                } catch (error) {
                    log('Failed to fetch instruments: ' + error.message);
                }
            }
            
            async function testSubscribe() {
                try {
                    const response = await fetch('/test/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            instrumentKeys: [
                                'NSE_FO|45450', // Nifty Call Option
                                'NSE_FO|45451', // Nifty Put Option
                                'NSE_FO|50904', // Bank Nifty Call Option
                                'NSE_FO|50923'  // Bank Nifty Put Option
                            ],
                            mode: 'option_greeks'
                        })
                    });
                    const result = await response.json();
                    log('Test subscription sent: ' + result.message);
                } catch (error) {
                    log('Failed to send test subscription: ' + error.message);
                }
            }
            
            // Auto-check status every 5 seconds
            setInterval(checkStatus, 5000);
        </script>
    </body>
    </html>
  `);
});

// Start the test server
(async () => {
  try {
    console.log("🚀 [OPTIONS TEST] Starting Options Test Environment...");
    
    // Initialize protobuf first
    await initProtobuf();

    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 [OPTIONS TEST] Test server running on http://localhost:${PORT}`);
      console.log(`📊 [OPTIONS TEST] Open browser to see test interface`);
    });

  } catch (error) {
    console.error("❌ [OPTIONS TEST] Startup error:", error);
  }
})();
