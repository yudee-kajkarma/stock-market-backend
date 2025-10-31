const WebSocket = require('ws');
const axios = require('axios');
const protobuf = require('protobufjs');

const ACCESS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGVkY2JjZTk2MDkzMTY0NDZlYjAyOGEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc2MDQxNDY3MCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzYwNDc5MjAwfQ.e4qQS1Fqk3WLHesejiggKg_JcAFCcgHseJLowmT1EN4';
const receivedData = [];

// Load protobuf definition
async function loadProto() {
    const root = await protobuf.load('MarketDataFeedV3.proto');
    return root.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');
}

// Get WebSocket authorization
async function getMarketDataFeedAuthorize() {
    try {
        const response = await axios.get(
            'https://api.upstox.com/v2/feed/market-data-feed/authorize',
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Authorization error:', error.response?.data || error.message);
        throw error;
    }
}

// Fetch option chain data
async function fetchOptionChain(instrumentKey, expiryDate) {
    try {
        const response = await axios.get(
            'https://api.upstox.com/v2/option/chain',
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                params: {
                    'instrument_key': instrumentKey,
                    'expiry_date': expiryDate
                }
            }
        );
        return response.data.data;
    } catch (error) {
        console.error('Option chain fetch error:', error.response?.data || error.message);
        throw error;
    }
}

// Main function to connect and stream data
async function fetchMarketData() {
    try {
        // Load protobuf
        const FeedResponse = await loadProto();
        
        // Get authorization
        const authResponse = await getMarketDataFeedAuthorize();
        const wsUrl = authResponse.data.authorizedRedirectUri;
        
        // Create WebSocket connection
        const ws = new WebSocket(wsUrl, {
            rejectUnauthorized: false
        });
        
        ws.on('open', async () => {
            console.log('Connection established');
            
            try {
                // Fetch option chain data
                const optionChain = await fetchOptionChain(
                    'NSE_INDEX|Nifty Bank',
                    '2024-02-29'  // Update with desired expiry date
                );
                
                // Extract instrument keys
                const instrumentKeys = [];
                optionChain.forEach(option => {
                    if (option.call_options?.instrument_key) {
                        instrumentKeys.push(option.call_options.instrument_key);
                    }
                    if (option.put_options?.instrument_key) {
                        instrumentKeys.push(option.put_options.instrument_key);
                    }
                });
                
                console.log(`Subscribing to ${instrumentKeys.length} instruments...`);
                
                // Subscribe to all instruments
                for (const instrumentKey of instrumentKeys) {
                    const subscriptionData = {
                        guid: 'someguid',
                        method: 'sub',
                        data: {
                            mode: 'full',
                            instrumentKeys: [instrumentKey]
                        }
                    };
                    
                    ws.send(JSON.stringify(subscriptionData));
                }
                
                console.log('Subscription request sent');
                
            } catch (error) {
                console.error('Error during subscription:', error.message);
                ws.close();
            }
        });
        
        ws.on('message', (data) => {
            try {
                // Decode protobuf message
                const decodedData = FeedResponse.decode(new Uint8Array(data));
                const dataDict = FeedResponse.toObject(decodedData, {
                    longs: String,
                    enums: String,
                    bytes: String
                });
                
                // Store and print data
                receivedData.push(dataDict);
                console.log(JSON.stringify(dataDict, null, 4));
                
            } catch (error) {
                console.error('Error decoding message:', error.message);
            }
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
        });
        
        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
        
    } catch (error) {
        console.error('Fatal error:', error.message);
    }
}

// Run the application
fetchMarketData();
