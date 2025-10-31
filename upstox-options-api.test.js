const UpstoxClient = require("upstox-js-sdk");

// Configure the API client
const defaultClient = UpstoxClient.ApiClient.instance;
const OAUTH2 = defaultClient.authentications["OAUTH2"];
OAUTH2.accessToken =
  "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGVkY2JjZTk2MDkzMTY0NDZlYjAyOGEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc2MDQxNDY3MCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzYwNDc5MjAwfQ.e4qQS1Fqk3WLHesejiggKg_JcAFCcgHseJLowmT1EN4"; // Replace with your actual access token

const apiInstance = new UpstoxClient.OptionsApi();

// Test 1: Get Option Contracts
async function testGetOptionContracts() {
  console.log("\n--- Testing getOptionContracts ---");

  const instrumentKey = "NSE_INDEX|Nifty 50"; // Example instrument key
  const opts = {
    expiryDate: "2025-10-28", // Example expiry date in YYYY-mm-dd format
  };

  try {
    const data = await new Promise((resolve, reject) => {
      apiInstance.getOptionContracts(
        instrumentKey,
        opts,
        (error, data, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        }
      );
    });

    console.log("✓ getOptionContracts successful");
    console.log("Response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("✗ getOptionContracts failed:", error);
    throw error;
  }
}

// Test 2: Get Put/Call Option Chain
async function testGetPutCallOptionChain() {
  console.log("\n--- Testing getPutCallOptionChain ---");

  const instrumentKey = "NSE_INDEX|Nifty 50"; // Example instrument key
  const expiryDate = "2025-10-30"; // Example expiry date in YYYY-mm-dd format

  try {
    const data = await new Promise((resolve, reject) => {
      apiInstance.getPutCallOptionChain(
        instrumentKey,
        expiryDate,
        (error, data, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        }
      );
    });

    console.log("✓ getPutCallOptionChain successful");
    console.log("Response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("✗ getPutCallOptionChain failed:", error);
    throw error;
  }
}

// Run all tests
async function runTests() {
  console.log("Starting Upstox Options API Tests...");
  console.log("Base URL:", "https://api.upstox.com");

  try {
    await testGetOptionContracts();
    await testGetPutCallOptionChain();

    console.log("\n✓ All tests completed successfully!");
  } catch (error) {
    console.error("\n✗ Tests failed with error:", error.message);
    process.exit(1);
  }
}

// Execute tests
runTests();
