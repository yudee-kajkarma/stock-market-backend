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

const PORT = process.env.PORT || 3000;

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
let optionsWs = null; // Separate WebSocket for options data
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

// Function to get available instruments for testing
const getTestInstruments = async () => {
  try {
    const accessToken = await getAccessTokenFromDB();
    const url = "https://api.upstox.com/v3/instrument/search?query=NIFTY";
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    
    console.log('🔍 Fetching available instruments...');
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.data) {
      // Filter for options instruments
      const optionsInstruments = response.data.data.filter(instrument => 
        instrument.segment === 'NSE_FO' && 
        instrument.name.includes('NIFTY') &&
        (instrument.name.includes('CE') || instrument.name.includes('PE'))
      ).slice(0, 10); // Get first 10 options
      
      console.log('✅ Found options instruments:', optionsInstruments.length);
      return optionsInstruments.map(inst => `${inst.exchange}|${inst.instrument_token}`);
    }
    
    return [];
  } catch (error) {
    console.error('❌ Failed to fetch instruments:', error.message);
    // Return fallback instruments
    return [
      "NSE_FO|45450", // Nifty Call Option
      "NSE_FO|45451", // Nifty Put Option
      "NSE_FO|50904", // Bank Nifty Call Option
      "NSE_FO|50923"  // Bank Nifty Put Option
    ];
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

// Function to establish WebSocket connection for options data
const connectOptionsWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      followRedirects: true,
    });

    // WebSocket event handlers for options
    ws.on("open", () => {
      console.log("✅ Connected to Upstox Options WebSocket");
      resolve(ws);

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log("💓 Sending heartbeat ping");
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
            mode: "ltpc",
            instrumentKeys: [
              "NSE_INDEX|Nifty 50", // Known working instrument
              "NSE_INDEX|Nifty Bank" // Another known working instrument
            ],
          },
        };
        
        console.log("📡 Sending LTPC test subscription:", JSON.stringify(ltpcTest, null, 2));
        ws.send(Buffer.from(JSON.stringify(ltpcTest)));
        
        // Then try option instruments with option_greeks mode
        setTimeout(() => {
          const optionGreeksTest = {
            guid: "options_greeks_" + Date.now(),
            method: "sub",
            data: {
              mode: "option_greeks",
              instrumentKeys: [
                "NSE_FO|45450", // Nifty options
                "NSE_FO|45451", // Nifty options
                "NSE_FO|50904", // Bank Nifty options
                "NSE_FO|50923", // Bank Nifty options
                "NSE_FO|60907"  // Another option
              ],
            },
          };
          
          console.log("📡 Sending option Greeks subscription:", JSON.stringify(optionGreeksTest, null, 2));
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
          
          console.log("📡 Sending full mode subscription:", JSON.stringify(fullModeTest, null, 2));
          ws.send(Buffer.from(JSON.stringify(fullModeTest)));
        }, 4000);
      }, 1000);
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 Disconnected from Options WebSocket. Code: ${code}, Reason: ${reason}`);
      optionsWs = null;
    });

    ws.on("message", (data) => {
      try {
        console.log("📥 Raw options message received, size:", data.length, "bytes");
        
        // Decode the protobuf message
        const decoded = decodeProfobuf(data);

        if (decoded) {
          console.log("🔍 Decoded options data:");
          console.log(JSON.stringify(decoded, null, 2));

          // Send to Socket.IO clients
          io.emit("optionsData", {
            timestamp: Date.now(),
            data: decoded
          });

          // Extract and process Option Greeks data with enhanced parsing
          if (decoded.feeds) {
            const optionGreeksData = {};
            let foundGreeks = false;

            Object.keys(decoded.feeds).forEach((key) => {
              const feed = decoded.feeds[key];
              
              console.log(`📊 Processing feed for instrument ${key}:`);
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
                
                console.log(`📋 Found firstLevelWithGreeks structure for ${key}`);
              }
              // Check for fullFeed structure (full mode)
              else if (feed.fullFeed && feed.fullFeed.marketFF) {
                const marketFF = feed.fullFeed.marketFF;
                optionGreeks = marketFF.optionGreeks;
                ltp = marketFF.ltpc ? marketFF.ltpc.ltp : null;
                vtt = marketFF.vtt;
                oi = marketFF.oi;
                iv = marketFF.iv;
                
                console.log(`📋 Found fullFeed.marketFF structure for ${key}`);
              }
              // Check for direct LTPC structure
              else if (feed.ltpc) {
                ltp = feed.ltpc.ltp;
                console.log(`📋 Found LTPC only structure for ${key}`);
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
                
                console.log(`✅ Found Greeks for ${key}:`, optionGreeksData[key]);
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
                console.log(`📊 Found LTP data for ${key}:`, optionGreeksData[key]);
              } else {
                console.log(`❌ No Greeks or LTP found for ${key}`);
                console.log(`Available fields:`, Object.keys(feed));
              }
            });

            if (foundGreeks || Object.keys(optionGreeksData).length > 0) {
              console.log("📈 Emitting option data:", optionGreeksData);
              io.emit("optionGreeks", { 
                timestamp: Date.now(), 
                data: optionGreeksData 
              });
            } else {
              console.log("⚠️ No option data found in any feed");
            }
          } else {
            console.log("⚠️ No feeds found in decoded data");
          }
        } else {
          console.log("❌ Failed to decode options message");
        }
      } catch (error) {
        console.error("❌ Error processing options message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ Options WebSocket error:", error);
      reject(error);
    });

    ws.on("ping", () => {
      console.log("🏓 Received ping from server");
    });

    ws.on("pong", () => {
      console.log("🏓 Received pong from server");
    });
  });
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

  // Handle subscription requests for options from frontend
  socket.on("subscribeOptions", async (instruments) => {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      socket.emit("error", { message: "Options WebSocket not connected" });
      return;
    }

    try {
      const data = {
        guid: "optionsrequest",
        method: "sub",
        data: {
          mode: "option_greeks", // Specific mode for option Greeks
          instrumentKeys: Array.isArray(instruments)
            ? instruments
            : [
                "NSE_FO|50904"
              ],
        },
      };

      optionsWs.send(Buffer.from(JSON.stringify(data)));
      socket.emit("optionsSubscribed", { instruments: data.data.instrumentKeys });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to send options subscription: " + error.message,
      });
    }
  });

  // Handle unsubscribe requests for options
  socket.on("unsubscribeOptions", async (instruments) => {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      socket.emit("error", { message: "Options WebSocket not connected" });
      return;
    }

    try {
      const data = {
        guid: "optionsunsubscribe",
        method: "unsub",
        data: {
          instrumentKeys: Array.isArray(instruments) ? instruments : [],
        },
      };

      optionsWs.send(Buffer.from(JSON.stringify(data)));
      socket.emit("optionsUnsubscribed", { instruments: data.data.instrumentKeys });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to unsubscribe options: " + error.message,
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
    optionsConnected: optionsWs && optionsWs.readyState === WebSocket.OPEN,
    protobufInitialized: protobufRoot !== null,
  });
});

// API endpoint to start options WebSocket connection
app.get("/api/options/start", async (req, res) => {
  try {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      console.log("🚀 Starting Options WebSocket connection...");
      const wsUrl = await getMarketFeedUrl();
      optionsWs = await connectOptionsWebSocket(wsUrl);
      res.json({ success: true, message: "Options WebSocket connection started" });
    } else {
      res.json({ success: true, message: "Options WebSocket already connected" });
    }
  } catch (error) {
    console.error("❌ Failed to start Options WebSocket:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simplified endpoint for easier access
app.get("/options/start", async (req, res) => {
  try {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      console.log("🚀 Starting Options WebSocket connection...");
      const wsUrl = await getMarketFeedUrl();
      optionsWs = await connectOptionsWebSocket(wsUrl);
      res.json({ success: true, message: "Options WebSocket connection started" });
    } else {
      res.json({ success: true, message: "Options WebSocket already connected" });
    }
  } catch (error) {
    console.error("❌ Failed to start Options WebSocket:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to subscribe to specific option instruments
app.post("/api/options/subscribe", async (req, res) => {
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
        error: "Options WebSocket not connected. Call /api/options/start first." 
      });
    }

    const data = {
      guid: "api_options_request",
      method: "sub",
      data: {
        mode: mode, // option_greeks, full, or ltpc
        instrumentKeys: instrumentKeys,
      },
    };

    optionsWs.send(Buffer.from(JSON.stringify(data)));
    
    res.json({ 
      success: true, 
      message: "Successfully subscribed to option instruments",
      data: {
        instrumentKeys: instrumentKeys,
        mode: mode,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to subscribe to options",
      details: error.message 
    });
  }
});

// Simplified endpoint for easier access
app.post("/options/subscribe", async (req, res) => {
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
        error: "Options WebSocket not connected. Call /options/start first." 
      });
    }

    const data = {
      guid: "options_request_" + Date.now(),
      method: "sub",
      data: {
        mode: mode,
        instrumentKeys: instrumentKeys,
      },
    };

    console.log("📡 Options subscription request:", JSON.stringify(data, null, 2));
    optionsWs.send(Buffer.from(JSON.stringify(data)));
    
    res.json({ 
      success: true, 
      message: "Successfully subscribed to option instruments",
      data: {
        instrumentKeys: instrumentKeys,
        mode: mode,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to subscribe to options",
      details: error.message 
    });
  }
});

// API endpoint to unsubscribe from option instruments
app.post("/api/options/unsubscribe", async (req, res) => {
  try {
    const { instrumentKeys } = req.body;

    if (!instrumentKeys || !Array.isArray(instrumentKeys)) {
      return res.status(400).json({ 
        success: false, 
        error: "instrumentKeys array is required" 
      });
    }

    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      return res.status(400).json({ 
        success: false, 
        error: "Options WebSocket not connected" 
      });
    }

    const data = {
      guid: "api_options_unsub",
      method: "unsub",
      data: {
        instrumentKeys: instrumentKeys,
      },
    };

    optionsWs.send(Buffer.from(JSON.stringify(data)));
    
    res.json({ 
      success: true, 
      message: "Successfully unsubscribed from option instruments",
      data: {
        instrumentKeys: instrumentKeys,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to unsubscribe from options",
      details: error.message 
    });
  }
});

// API endpoint to get available instruments for options trading
app.get("/api/options/instruments", async (req, res) => {
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

// Simplified endpoint for easier access
app.get("/options/instruments", async (req, res) => {
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

// API endpoint to get options connection status
app.get("/api/options/status", (req, res) => {
  res.json({
    success: true,
    data: {
      optionsConnected: optionsWs && optionsWs.readyState === WebSocket.OPEN,
      connectionState: optionsWs ? optionsWs.readyState : null,
      protobufInitialized: protobufRoot !== null,
      timestamp: new Date().toISOString()
    }
  });
});

// Simplified endpoint for easier access
app.get("/options/status", (req, res) => {
  res.json({
    success: true,
    data: {
      optionsConnected: optionsWs && optionsWs.readyState === WebSocket.OPEN,
      connectionState: optionsWs ? optionsWs.readyState : null,
      protobufInitialized: protobufRoot !== null,
      timestamp: new Date().toISOString()
    }
  });
});

// Debug endpoint to test options data flow
app.get("/api/options/debug", (req, res) => {
  try {
    const debugInfo = {
      optionsWebSocket: {
        exists: !!optionsWs,
        readyState: optionsWs ? optionsWs.readyState : null,
        readyStateText: optionsWs ? 
          (optionsWs.readyState === 0 ? 'CONNECTING' :
           optionsWs.readyState === 1 ? 'OPEN' :
           optionsWs.readyState === 2 ? 'CLOSING' :
           optionsWs.readyState === 3 ? 'CLOSED' : 'UNKNOWN') : null
      },
      protobuf: {
        initialized: !!protobufRoot,
        rootExists: !!protobufRoot
      },
      accessToken: {
        cached: !!cachedAccessToken,
        cacheTime: tokenCacheTime ? new Date(tokenCacheTime).toISOString() : null
      },
      socketIO: {
        connectedClients: io.engine.clientsCount
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint to manually trigger options subscription
app.post("/api/options/test-subscribe", (req, res) => {
  try {
    if (!optionsWs || optionsWs.readyState !== WebSocket.OPEN) {
      return res.status(400).json({
        success: false,
        error: "Options WebSocket not connected",
        readyState: optionsWs ? optionsWs.readyState : null
      });
    }

    const testInstruments = req.body.instrumentKeys || [
      "NSE_FO|45450",
      "NSE_FO|45451"
    ];

    const data = {
      guid: "manual_test_" + Date.now(),
      method: "sub",
      data: {
        mode: "option_greeks",
        instrumentKeys: testInstruments,
      },
    };

    console.log("📡 Manual test subscription:", JSON.stringify(data, null, 2));
    optionsWs.send(Buffer.from(JSON.stringify(data)));

    res.json({
      success: true,
      message: "Test subscription sent",
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
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
