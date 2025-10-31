# Option Chain API Documentation

## Overview

The Option Chain API provides real-time option chain data from Upstox with support for auto-refresh functionality.

## Endpoints

### 1. Get Option Chain Data

Fetch option chain data for a specific instrument and expiry date.

**Endpoint:** `GET /api/option-chain` or `GET /option-chain`

**Query Parameters:**
- `instrument_key` (optional): The instrument key (default: "NSE_INDEX|Nifty 50")
- `expiry_date` (optional): The expiry date in YYYY-MM-DD format (default: "2025-11-25")

**Example Request:**
```bash
curl "http://localhost:3000/api/option-chain?instrument_key=NSE_INDEX|Nifty%2050&expiry_date=2025-11-25"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "strike_price": 23000,
        "call_options": {
          "instrument_key": "NSE_FO|12345",
          "market_data": {
            "ltp": 125.50,
            "volume": 1000,
            "oi": 50000,
            "close_price": 120.00
          },
          "option_greeks": {
            "delta": 0.55,
            "gamma": 0.02,
            "theta": -0.05,
            "vega": 0.15,
            "iv": 18.5
          }
        },
        "put_options": {
          "instrument_key": "NSE_FO|12346",
          "market_data": {
            "ltp": 85.25,
            "volume": 800,
            "oi": 45000,
            "close_price": 82.00
          },
          "option_greeks": {
            "delta": -0.45,
            "gamma": 0.02,
            "theta": -0.05,
            "vega": 0.15,
            "iv": 17.8
          }
        }
      }
    ]
  },
  "timestamp": "2025-10-31T10:30:00.000Z"
}
```

## Usage Examples

### 1. HTML/JavaScript Client (Browser)

Open `option-chain-example.html` in your browser:

```bash
# Start your server first
npm start

# Then open the HTML file in your browser
open option-chain-example.html
```

Features:
- Auto-refresh every 2 seconds (configurable)
- Visual display of call and put options
- Start/Stop controls
- Real-time updates

### 2. Node.js Client (Command Line)

**Auto-refresh mode (default 2 seconds):**
```bash
node option-chain-client.js
```

**Auto-refresh with custom interval (5 seconds):**
```bash
node option-chain-client.js auto 5
```

**Fetch once and exit:**
```bash
node option-chain-client.js once
```

**Fetch once with custom parameters:**
```bash
node option-chain-client.js once "NSE_INDEX|Nifty Bank" "2025-11-25"
```

### 3. Using as a Module

```javascript
const { fetchOptionChain, startAutoRefresh, stopAutoRefresh } = require('./option-chain-client');

// Fetch once
async function example1() {
  const data = await fetchOptionChain('NSE_INDEX|Nifty 50', '2025-11-25');
  console.log(data);
}

// Auto-refresh every 2 seconds
function example2() {
  startAutoRefresh(2000);
  
  // Stop after 30 seconds
  setTimeout(() => {
    stopAutoRefresh();
  }, 30000);
}
```

### 4. Using with Axios

```javascript
const axios = require('axios');

async function getOptionChain() {
  try {
    const response = await axios.get('http://localhost:3000/api/option-chain', {
      params: {
        instrument_key: 'NSE_INDEX|Nifty 50',
        expiry_date: '2025-11-25'
      }
    });
    
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Call every 2 seconds
setInterval(getOptionChain, 2000);
```

### 5. Using with Fetch API (Browser)

```javascript
async function fetchOptionChain() {
  try {
    const response = await fetch(
      'http://localhost:3000/api/option-chain?instrument_key=NSE_INDEX|Nifty%2050&expiry_date=2025-11-25'
    );
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Auto-refresh every 2 seconds
setInterval(fetchOptionChain, 2000);
```

## Common Instrument Keys

### Indices
- `NSE_INDEX|Nifty 50`
- `NSE_INDEX|Nifty Bank`
- `NSE_INDEX|Nifty IT`
- `NSE_INDEX|Nifty Fin Service`

### Stocks (for stock options)
- `NSE_EQ|INE002A01018` (Reliance)
- `NSE_EQ|INE040A01034` (HDFC Bank)
- `NSE_EQ|INE009A01021` (Infosys)

## Error Handling

The API returns appropriate HTTP status codes:

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server error or Upstox API error

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details from Upstox API
  }
}
```

## Rate Limiting

**Important:** While the API supports frequent polling (every 2 seconds), be aware of:

1. **Upstox API Rate Limits**: Check Upstox documentation for their rate limits
2. **Network Performance**: Frequent requests may impact network performance
3. **Server Load**: Consider the load on your server

**Recommended Intervals:**
- Development/Testing: 5-10 seconds
- Production: 2-5 seconds (based on your needs)
- Heavy Load: 10-30 seconds

## Best Practices

1. **Error Handling**: Always implement proper error handling
2. **Cleanup**: Stop intervals when not needed (e.g., when user navigates away)
3. **Token Management**: Ensure your access token is valid and refreshed
4. **Caching**: Consider caching data if multiple clients need the same data
5. **WebSocket Alternative**: For real-time updates, consider using the WebSocket endpoints instead

## Related Endpoints

- `/start` - Start WebSocket connection for real-time data
- `/api/options/subscribe` - Subscribe to specific option instruments via WebSocket
- `/api/options/instruments` - Get available option instruments

## Troubleshooting

### "Upstox access token not configured"
- Ensure your access token is stored in the database
- Use `/api/token/update` to update the token

### "Failed to fetch option chain"
- Check if the instrument key is valid
- Verify the expiry date format (YYYY-MM-DD)
- Ensure the expiry date is a valid trading day

### CORS errors in browser
- The server has CORS enabled for all origins in development
- For production, configure CORS properly

## Support

For issues or questions:
1. Check the server logs for detailed error messages
2. Verify your Upstox API credentials
3. Test the token with `/api/token/test`
