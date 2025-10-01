// Import required modules
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws").WebSocket;
const protobuf = require("protobufjs");
const axios = require("axios");
const cors = require("cors");

// Setup Express and Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For development. Restrict in production
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Enable CORS for REST API
app.use(cors());
app.use(express.json());

// Initialize global variables
let protobufRoot = null;
let upstoxWs = null;
const accessToken =
  "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGRjYzFiZDJjMzkwMDI1ZmU4YzQwZTYiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTI5Nzk4MSwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5MzU2MDAwfQ.iUdV1oCNL1n854_SUYPCTHszklHjlHjG95AvslYbIho";

// Function to authorize the market data feed
const getMarketFeedUrl = async () => {
  const url = "https://api.upstox.com/v3/feed/market-data-feed/authorize";
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  const response = await axios.get(url, { headers });
  return response.data.data.authorizedRedirectUri;
};

// Function to establish WebSocket connection
const connectWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      followRedirects: true,
    });

    // WebSocket event handlers
    ws.on("open", () => {
      console.log("✅ Connected to Upstox WebSocket");
      resolve(ws); // Resolve the promise once connected

      // Set a timeout to send a subscription message after 1 second
      setTimeout(() => {
        const data = {
          guid: "someguid",
          method: "sub",
          data: {
            mode: "full",
            instrumentKeys: [
              "NSE_INDEX|Nifty Bank",
              "NSE_INDEX|Nifty 50",
              "NSE_INDEX|Nifty IT",
              "NSE_EQ|INE002A01018", // RELIANCE
              "NSE_EQ|INE040A01034", // HDFC BANK
              "NSE_EQ|INE009A01021", // INFOSYS
              "NSE_EQ|INE030A01027", // BHARTI AIRTEL
              "NSE_EQ|INE062A01020",
            ],
            // instrumentKeys: ["NSE_FO|60907"],
          },
        };
        ws.send(Buffer.from(JSON.stringify(data)));
        console.log("📡 Sent subscription to Upstox");
      }, 1000);
    });

    ws.on("close", () => {
      console.log("🔌 Disconnected from Upstox WebSocket");
      upstoxWs = null;
    });

    ws.on("message", (data) => {
      try {
        // Decode the protobuf message
        const decoded = decodeProfobuf(data);

        if (decoded) {
          // Log the decoded data structure for debugging
          // console.log("Decoded data structure:", JSON.stringify(decoded, null, 2));

          // Send the decoded data to all connected Socket.IO clients
          io.emit("marketData", decoded);

          // Extract and send LTP (Last Traded Price) data if available
          if (decoded.feeds) {
            const ltpData = {};

            Object.keys(decoded.feeds).forEach((key) => {
              const feed = decoded.feeds[key];
              console.log(
                `Processing feed for ${key}:`,
                JSON.stringify(feed, null, 2)
              );

              // Try to find LTP in various possible locations
              const ltp =
                feed.ltp ||
                (feed.price && feed.price.ltp) ||
                (feed.ff &&
                  feed.ff.marketFF &&
                  feed.ff.marketFF.ltpc &&
                  feed.ff.marketFF.ltpc.ltp) ||
                feed.lastTradedPrice ||
                feed.lastPrice;

              if (ltp) {
                ltpData[key] = ltp;
                // console.log(`Found LTP for ${key}:`, ltp);
              } else {
                // console.log(`No LTP found for ${key}`);
              }
            });

            if (Object.keys(ltpData).length > 0) {
              io.emit("ltp", { timestamp: Date.now(), data: ltpData });
            }
          }
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
      }
    });

    ws.on("error", (error) => {
      console.log("❌ Upstox WebSocket error:", error);
      reject(error); // Reject the promise on error
    });
  });
};

// Function to initialize the protobuf part
const initProtobuf = async () => {
  try {
    protobufRoot = await protobuf.load(__dirname + "/MarketDataFeedV3.proto");
    console.log("✅ Protobuf initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize protobuf:", error);
    return false;
  }
};

// Function to decode protobuf message
const decodeProfobuf = (buffer) => {
  if (!protobufRoot) {
    console.warn("⚠️ Protobuf not initialized yet!");
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
    console.error("❌ Failed to decode protobuf:", error);
    return null;
  }
};

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("👤 Frontend client connected:", socket.id);

  // Handle client disconnect
  socket.on("disconnect", () => {
    console.log("👤 Frontend client disconnected:", socket.id);
  });

  // Handle subscription requests from frontend
  socket.on("subscribe", async (instruments) => {
    if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
      socket.emit("error", { message: "WebSocket not connected" });
      return;
    }

    try {
      const data = {
        guid: "clientrequest",
        method: "sub",
        data: {
          mode: "full",
          instrumentKeys: Array.isArray(instruments)
            ? instruments
            : [
              "NSE_INDEX|Nifty Bank",
              "NSE_INDEX|Nifty 50",
              "NSE_INDEX|Nifty IT",
              "NSE_EQ|INE002A01018", // RELIANCE
              "NSE_EQ|INE040A01034", // HDFC BANK
              "NSE_EQ|INE009A01021", // INFOSYS
              "NSE_EQ|INE030A01027", // BHARTI AIRTEL
              "NSE_EQ|INE062A01020",
            ],
        },
      };

      upstoxWs.send(Buffer.from(JSON.stringify(data)));
      socket.emit("subscribed", { instruments: data.data.instrumentKeys });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to send subscription: " + error.message,
      });
    }
  });
});

// API Routes
app.get("/start", async (req, res) => {
  try {
    if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
      console.log("🚀 Starting WebSocket connection...");
      const wsUrl = await getMarketFeedUrl();
      upstoxWs = await connectWebSocket(wsUrl);
      res.json({ success: true, message: "WebSocket connection started" });
    } else {
      res.json({ success: true, message: "WebSocket already connected" });
    }
  } catch (error) {
    console.error("❌ Failed to start WebSocket:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/status", (req, res) => {
  res.json({
    connected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
    protobufInitialized: protobufRoot !== null,
  });
});

// Start server and initialize
(async () => {
  try {
    // Initialize protobuf first
    await initProtobuf();

    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Auto-connect to Upstox WebSocket on startup
    const wsUrl = await getMarketFeedUrl();
    upstoxWs = await connectWebSocket(wsUrl);
  } catch (error) {
    console.error("❌ Startup error:", error);
  }
})();
