// Import required modules
require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws").WebSocket;
const protobuf = require("protobufjs");
const axios = require("axios");
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');

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

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://juisueefqgtvzezrzudv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aXN1ZWVmcWd0dnplenJ6dWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDUzNTcsImV4cCI6MjA3NDc4MTM1N30.zFzHnvlX5cyk7TfbOUZ1zB_depLTNWEzXmhDbcVlXYI";

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials are missing. Please check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize global variables
let protobufRoot = null;
let upstoxWs = null;
let cachedAccessToken = null;
let tokenCacheTime = null;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to fetch access token from Supabase (single row approach)
const getAccessTokenFromDB = async () => {
  try {
    // Check if we have a cached token that's still valid
    if (cachedAccessToken && tokenCacheTime && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
      console.log('🔄 Using cached access token');
      return cachedAccessToken;
    }

    console.log('🔍 Fetching access token from database...');
    
    // Get the single token row for upstox provider
    const { data, error } = await supabase
      .from('access_tokens')
      .select('token, expires_at')
      .eq('provider', 'upstox')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Error fetching access token from database:', error);
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
    
    console.log('✅ Successfully fetched access token from database');
    return data.token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.message);
    throw error;
  }
};

// Function to save access token to database (single row approach)
const saveAccessTokenToDB = async (token, expiresAt = null, provider = 'upstox') => {
  try {
    console.log('💾 Saving access token to database...');
    
    // Check if a row already exists for this provider
    const { data: existingToken, error: selectError } = await supabase
      .from('access_tokens')
      .select('id')
      .eq('provider', provider)
      .limit(1)
      .single();

    let result;
    
    if (existingToken && !selectError) {
      // Update the existing row
      console.log('🔄 Updating existing access token...');
      const { data, error } = await supabase
        .from('access_tokens')
        .update({
          token: token,
          expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingToken.id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating access token:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      result = data;
    } else {
      // Insert the first token
      console.log('➕ Inserting first access token...');
      const { data, error } = await supabase
        .from('access_tokens')
        .insert({
          provider: provider,
          token: token,
          expires_at: expiresAt,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting access token:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      result = data;
    }

    // Clear cache to force refresh
    cachedAccessToken = null;
    tokenCacheTime = null;
    
    console.log('✅ Successfully saved access token to database');
    return result;
  } catch (error) {
    console.error('❌ Failed to save access token:', error.message);
    throw error;
  }
};

// Function to authorize the market data feed
const getMarketFeedUrl = async () => {
  try {
    const accessToken = await getAccessTokenFromDB();
    const url = "https://api.upstox.com/v3/feed/market-data-feed/authorize";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    
    console.log('🔐 Authorizing market data feed with database token...');
    const response = await axios.get(url, { headers });
    console.log('✅ Successfully authorized market data feed');
    
    return response.data.data.authorizedRedirectUri;
  } catch (error) {
    console.error('❌ Failed to authorize market data feed:', error.message);
    throw error;
  }
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
          console.log("Decoded data structure:", JSON.stringify(decoded, null, 2));

          // Send the decoded data to all connected Socket.IO clients
          io.emit("marketData", decoded);

          // Extract and send LTP (Last Traded Price) data if available
          if (decoded.feeds) {
            const ltpData = {};

            Object.keys(decoded.feeds).forEach((key) => {
              const feed = decoded.feeds[key];
              // console.log(
              //   `Processing feed for ${key}:`,
              //   JSON.stringify(feed, null, 2)
              // );

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
        // console.error("❌ Error processing message:", error);
      }
    });

    ws.on("error", (error) => {
      // console.log("❌ Upstox WebSocket error:", error);
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
    // console.error("❌ Failed to decode protobuf:", error);
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
      // console.log("🚀 Starting WebSocket connection...");
      const wsUrl = await getMarketFeedUrl();
      upstoxWs = await connectWebSocket(wsUrl);
      res.json({ success: true, message: "WebSocket connection started" });
    } else {
      res.json({ success: true, message: "WebSocket already connected" });
    }
  } catch (error) {
    // console.error("❌ Failed to start WebSocket:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/status", (req, res) => {
  res.json({
    connected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
    protobufInitialized: protobufRoot !== null,
  });
});

// API endpoint to get current access token info
app.get("/api/token/info", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('id, provider, expires_at, is_active, created_at, updated_at')
      .eq('provider', 'upstox')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'No active access token found',
        details: error.message 
      });
    }

    res.json({ 
      success: true, 
      data: {
        ...data,
        isExpired: data.expires_at ? new Date(data.expires_at) < new Date() : false
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch token info',
      details: error.message 
    });
  }
});

// API endpoint to update access token
app.post("/api/token/update", async (req, res) => {
  try {
    const { token, expires_at, provider = 'upstox' } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }

    const result = await saveAccessTokenToDB(token, expires_at, provider);
    
    res.json({ 
      success: true, 
      message: 'Access token updated successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update access token',
      details: error.message 
    });
  }
});

// API endpoint to test current access token
app.get("/api/token/test", async (req, res) => {
  try {
    const accessToken = await getAccessTokenFromDB();
    
    // Test the token by making a simple API call
    const testUrl = "https://api.upstox.com/v2/user/profile";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    
    const response = await axios.get(testUrl, { headers });
    
    res.json({ 
      success: true, 
      message: 'Access token is valid',
      profile: response.data
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: 'Access token test failed',
      details: error.message 
    });
  }
});

// Start server and initialize
(async () => {
  try {
    // Initialize protobuf first
    await initProtobuf();

    // Start the server
    server.listen(PORT, () => {
      // console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Auto-connect to Upstox WebSocket on startup
    const wsUrl = await getMarketFeedUrl();
    upstoxWs = await connectWebSocket(wsUrl);
  } catch (error) {
    // console.error("❌ Startup error:", error);
  }
})();
