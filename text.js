const WebSocket = require("ws").WebSocket;
const https = require("https");

// Replace this with your actual access token
const ACCESS_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGVkY2JjZTk2MDkzMTY0NDZlYjAyOGEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc2MDQxNDY3MCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzYwNDc5MjAwfQ.e4qQS1Fqk3WLHesejiggKg_JcAFCcgHseJLowmT1EN4";

// Step 1: Get the actual WebSocket URL via HTTP redirect
function getWebSocketUrl() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.upstox.com",
      path: "/v2/feed/market-data-v3",
      method: "GET",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "*/*",
      },
      followRedirect: false, // Don't auto-follow, we need the Location header
    };

    const req = https.request(options, (res) => {
      console.log(`📡 HTTP Response: ${res.statusCode} ${res.statusMessage}`);
      console.log("📋 Headers:", res.headers);

      // Upstox returns 302 redirect with the actual WebSocket URL
      if (
        (res.statusCode === 302 || res.statusCode === 301) &&
        res.headers.location
      ) {
        console.log("✅ Got WebSocket URL:", res.headers.location);
        resolve(res.headers.location);
      } else if (res.statusCode === 200) {
        // Some APIs return 200 with body containing the URL
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log("📄 Response body:", data);
          reject(
            new Error("Got 200 instead of redirect. Check response body above.")
          );
        });
      } else {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log("📄 Response body:", data);
          reject(
            new Error(
              `Unexpected response: ${res.statusCode} ${res.statusMessage}`
            )
          );
        });
      }
    });

    req.on("error", (err) => {
      console.error("❌ HTTP Request error:", err);
      reject(err);
    });
    req.end();
  });
}

// Step 2: Connect to the WebSocket
async function connectToUpstox() {
  try {
    const wsUrl = await getWebSocketUrl();

    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "*/*",
      },
    });

    // Once connected
    ws.on("open", () => {
      console.log("✅ Connected to Upstox Market Stream Feed");

      // Example: Subscribe to NIFTY 50 Option Chain data
      const payload = {
        guid: "GUID123",
        method: "sub",
        data: {
          mode: "full", // or 'option_greeks' if you only need greeks
          instrumentKeys: [
            "NSE_FO|45905", // Replace with your desired option instrument keys
          ],
        },
      };

      ws.send(JSON.stringify(payload));
      console.log("📡 Subscription request sent:", payload);
    });

    // Handle incoming messages
    ws.on("message", (message) => {
      try {
        const decoded = JSON.parse(message.toString());
        if (decoded.type === "market_info") {
          console.log("ℹ️ Market Status:", decoded.marketInfo.segmentStatus);
        } else if (decoded.type === "live_feed") {
          console.log("💹 Live Data:", JSON.stringify(decoded, null, 2));
        } else {
          console.log("📨 Other Data:", decoded);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    });

    // Handle errors
    ws.on("error", (err) => {
      console.error("❌ WebSocket error:", err.message);
    });

    // Handle connection close
    ws.on("close", () => {
      console.log("🔌 Connection closed");
    });
  } catch (err) {
    console.error("❌ Failed to connect:", err.message);
  }
}

// Start the connection
connectToUpstox();
