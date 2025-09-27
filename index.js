const express = require("express");
const WebSocket = require("ws").WebSocket;
const protobuf = require("protobufjs");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

let protobufRoot = null;
let wsConnection = null;

// Replace with your actual access token
const accessToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGQ3YTE3YzZkZGZhZjZmNmEzZTM5NjEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1ODk2MjA0NCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5MDEwNDAwfQ.D38pFzCgUfhdO7oaP3sWVV8QlnnZ5nQYerSm2Db8m0E";

// Initialize protobuf
const initProtobuf = async () => {
  protobufRoot = await protobuf.load(__dirname + "/MarketDataFeedV3.proto");
  console.log("Protobuf initialized");
};

// Decode protobuf messages
const decodeProtobuf = (buffer) => {
  if (!protobufRoot) {
    console.warn("Protobuf not initialized");
    return null;
  }
  const FeedResponse = protobufRoot.lookupType(
    "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
  );
  return FeedResponse.decode(buffer);
};

// Get WebSocket feed URL
const getMarketFeedUrl = async () => {
  const url = "https://api.upstox.com/v3/feed/market-data-feed/authorize";
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  const response = await axios.get(url, { headers });
  return response.data.data.authorizedRedirectUri;
};

// Connect WebSocket
const connectWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { followRedirects: true });

    ws.on("open", () => {
      console.log("WebSocket connected");
      resolve(ws);

      // Hardcoded subscription
      const data = {
        guid: "someguid",
        method: "sub",
        data: {
          mode: "full",
          instrumentKeys: ["NSE_INDEX|Nifty Bank", "NSE_INDEX|Nifty 50"],
        },
      };
      ws.send(Buffer.from(JSON.stringify(data)));
    });

    ws.on("close", () => console.log("WebSocket disconnected"));

    ws.on("message", (data) => {
      const decoded = decodeProtobuf(data);
      console.log(decoded);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      reject(error);
    });
  });
};

// Endpoint to start WebSocket
app.get("/start-feed", async (req, res) => {
  try {
    if (!wsConnection) {
      const wsUrl = await getMarketFeedUrl();
      wsConnection = await connectWebSocket(wsUrl);
      res.send("WebSocket feed started and subscribed to Nifty Bank & Nifty 50!");
    } else {
      res.send("WebSocket already running");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to start WebSocket feed");
  }
});

// Start Express server
app.listen(PORT, async () => {
  await initProtobuf();
  console.log(`Server running on http://localhost:${PORT}`);
});
