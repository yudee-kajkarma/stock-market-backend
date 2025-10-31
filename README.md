# Stock Market API

A Node.js and Express backend API for stock market data, designed for deployment on Vercel.

## Features

- 🚀 Express.js server with CORS support
- 📊 Mock stock market data endpoints
- 🔧 Environment configuration
- 🚀 Vercel deployment ready
- 📝 Health check endpoint
- 🛡️ Error handling middleware
- 📈 52-week high/low calculation job
- 🗄️ Supabase integration for data storage

## API Endpoints

### Base URL
- **Local**: `http://localhost:3000`
- **Production**: `https://your-app-name.vercel.app`

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and available endpoints |
| GET | `/api/health` | Health check endpoint |
| GET | `/api/stocks` | Get all available stocks |
| GET | `/api/stocks/:symbol` | Get specific stock by symbol |
| GET | `/run-highlow-job` | Manually trigger the 52-week high/low calculation job |
| GET | `/health` | Health check endpoint for the 52-week high/low job |
| GET | `/start` | Start the main WebSocket connection for market data |
| GET | `/status` | Get connection status for both market data and options |
| GET | `/api/options/start` | Start the options WebSocket connection |
| POST | `/api/options/subscribe` | Subscribe to specific option instruments |
| POST | `/api/options/unsubscribe` | Unsubscribe from option instruments |
| GET | `/api/options/status` | Get options connection status |
| GET | `/api/token/info` | Get current access token information |
| POST | `/api/token/update` | Update access token |
| GET | `/api/token/test` | Test current access token validity |

### Example Responses

#### Get All Stocks
```bash
GET /api/stocks
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "price": 175.43,
      "change": 2.15,
      "changePercent": 1.24
    }
  ],
  "count": 5
}
```

#### Get Specific Stock
```bash
GET /api/stocks/AAPL
```

Response:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 175.43,
    "change": 2.15,
    "changePercent": 1.24,
    "volume": 45678900,
    "marketCap": "2.7T"
  }
}
```

## Options Data API

The API now includes dedicated endpoints for live options data streaming using Upstox's Market Data Feed V3. This allows you to get real-time option Greeks (Delta, Gamma, Theta, Vega) and other option-specific data.

### Options Endpoints Usage

#### 1. Start Options Connection
```bash
GET /api/options/start
```

Response:
```json
{
  "success": true,
  "message": "Options WebSocket connection started"
}
```

#### 2. Subscribe to Option Instruments
```bash
POST /api/options/subscribe
Content-Type: application/json

{
  "instrumentKeys": ["NSE_FO|45450", "NSE_FO|45451"],
  "mode": "option_greeks"
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully subscribed to option instruments",
  "data": {
    "instrumentKeys": ["NSE_FO|45450", "NSE_FO|45451"],
    "mode": "option_greeks",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 3. Unsubscribe from Option Instruments
```bash
POST /api/options/unsubscribe
Content-Type: application/json

{
  "instrumentKeys": ["NSE_FO|45450"]
}
```

#### 4. Check Options Connection Status
```bash
GET /api/options/status
```

Response:
```json
{
  "success": true,
  "data": {
    "optionsConnected": true,
    "connectionState": 1,
    "protobufInitialized": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Socket.IO Events for Options

When connected via Socket.IO, you can listen to these events for real-time options data:

#### Events to Listen:
- `optionsData` - Raw options data from Upstox
- `optionGreeks` - Processed option Greeks data

#### Events to Emit:
- `subscribeOptions` - Subscribe to option instruments
- `unsubscribeOptions` - Unsubscribe from option instruments

#### Example Frontend Usage:
```javascript
const socket = io('http://localhost:3001');

// Listen for option Greeks data
socket.on('optionGreeks', (data) => {
  console.log('Option Greeks received:', data);
  // data.data contains instrument-wise Greeks:
  // {
  //   "NSE_FO|45450": {
  //     "delta": 0.65,
  //     "gamma": 0.02,
  //     "theta": -0.05,
  //     "vega": 0.15,
  //     "iv": 18.5,
  //     "ltp": 219.3,
  //     "timestamp": 1640995200000
  //   }
  // }
});

// Subscribe to specific options
socket.emit('subscribeOptions', ['NSE_FO|45450', 'NSE_FO|45451']);
```

### Supported Modes

- `option_greeks` - Contains only option Greeks data
- `full` - Includes LTPC, 5 market level quotes, extended feed metadata, and option Greeks
- `ltpc` - Contains only the latest trading price (LTP) and close price (CP) changes

### Important Notes

1. **Connection Limits**: According to Upstox V3 documentation:
   - Normal users: 2 connections per user
   - Upstox Plus users: 5 connections per user

2. **Subscription Limits**:
   - Option Greeks: 3000 instrument keys (individual), 2000 (combined)
   - Full mode: 2000 instrument keys (individual), 1500 (combined)

3. **Authentication**: Ensure you have a valid access token stored in the database using the `/api/token/update` endpoint.

4. **Instrument Keys**: Use proper NSE_FO format for option instruments (e.g., "NSE_FO|45450").

## Local Development Setup

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   cd stock-market-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   UPSTOX_ACCESS_TOKEN=your_upstox_access_token
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

5. **Test the API**
   ```bash
   curl http://localhost:3000/api/health
   ```

## Deployment on Vercel

### Method 1: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from project directory**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Set up and deploy? `Y`
   - Which scope? (Choose your account)
   - Link to existing project? `N`
   - Project name: `stock-market-api` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings? `N`

5. **Your API will be deployed and you'll get a URL like:**
   ```
   https://stock-market-api-xyz.vercel.app
   ```

### Method 2: Using GitHub Integration

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/stock-market-api.git
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect it's a Node.js project
   - Click "Deploy"

### Environment Variables on Vercel

1. **In Vercel Dashboard:**
   - Go to your project
   - Click "Settings" → "Environment Variables"
   - Add your environment variables:
     - `NODE_ENV` = `production`
     - `PORT` = `3000` (optional, Vercel handles this)

## Project Structure

```
stock-market-api/
├── index.js              # Main Express server
├── stock-highlow-job.js  # 52-week high/low job
├── package.json          # Dependencies and scripts
├── vercel.json          # Vercel deployment configuration
├── env.example          # Environment variables template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## 52-Week High/Low Job

This project includes a scheduled job that calculates the 52-week high and low values for specified stock instruments using the Upstox Historical Candle Data API. The results are stored in a Supabase table.

### Features

- Automatically runs every weekday at 3:35 PM IST
- Calculates 52-week high and low for specified stock instruments
- Stores results in a Supabase database
- Includes manual trigger endpoint for on-demand updates
- Comprehensive error handling and logging

### Setup Instructions

1. **Create the Supabase table:**
   ```sql
   CREATE TABLE stock_highlow (
     instrument_key VARCHAR PRIMARY KEY,
     high NUMERIC NOT NULL,
     low NUMERIC NOT NULL,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Configure environment variables:**
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   UPSTOX_ACCESS_TOKEN=your_upstox_access_token
   ```

3. **Run the job as a standalone server:**
   ```bash
   node stock-highlow-job.js
   ```

4. **Manually trigger the job:**
   ```bash
   curl http://localhost:3002/run-highlow-job
   ```

## Adding Additional Stock Data

To integrate with other stock market APIs, you can:

1. **Sign up for free APIs:**
   - [Alpha Vantage](https://www.alphavantage.co/) - Free tier available
   - [Finnhub](https://finnhub.io/) - Free tier available
   - [Polygon.io](https://polygon.io/) - Free tier available
   - [Upstox](https://upstox.com/) - API access available

2. **Add API keys to environment variables:**
   ```env
   ALPHA_VANTAGE_API_KEY=your_key_here
   FINNHUB_API_KEY=your_key_here
   UPSTOX_ACCESS_TOKEN=your_upstox_token
   ```

3. **Update the endpoints to fetch real data**

## Option Chain Client

The `option-chain-client.js` is a standalone client script that demonstrates how to fetch and monitor option chain data from your API endpoint with auto-refresh capabilities.

### Features

- 🔄 Auto-refresh option chain data at configurable intervals
- 📊 Real-time option chain monitoring
- 🎯 Support for custom instrument keys and expiry dates
- 💻 Command-line interface with multiple modes
- 🛑 Graceful shutdown handling
- 📦 Can be used as a module or standalone script

### Usage

#### 1. Auto-Refresh Mode (Default)

Continuously fetch option chain data every 2 seconds:

```bash
node option-chain-client.js
```

Or with custom interval (in seconds):

```bash
node option-chain-client.js auto 5
```

This will fetch data every 5 seconds.

#### 2. Fetch Once Mode

Fetch option chain data once and exit:

```bash
node option-chain-client.js once
```

With custom instrument and expiry:

```bash
node option-chain-client.js once "NSE_INDEX|Nifty 50" "2025-11-25"
```

#### 3. Use as a Module

You can also import and use the client in your own scripts:

```javascript
const { fetchOptionChain, startAutoRefresh, stopAutoRefresh } = require('./option-chain-client');

// Fetch once
await fetchOptionChain('NSE_INDEX|Nifty 50', '2025-11-25');

// Start auto-refresh
startAutoRefresh(3000); // Refresh every 3 seconds

// Stop auto-refresh
stopAutoRefresh();
```

### Configuration

Edit the constants at the top of the file to customize default behavior:

```javascript
const API_BASE_URL = 'http://localhost:3000';
const INSTRUMENT_KEY = 'NSE_INDEX|Nifty 50';
const EXPIRY_DATE = '2025-11-25';
const REFRESH_INTERVAL = 2000; // 2 seconds
```

### Output Example

```
📊 Fetching option chain for NSE_INDEX|Nifty 50 (Expiry: 2025-11-25)...
✅ Successfully fetched option chain data
⏰ Timestamp: 2025-10-31T10:30:00.000Z

📈 Option Chain Summary (50 strikes):
────────────────────────────────────────────────────────────────────────────────
Strike 23000: CALL LTP=245.50 (OI=1250000) | PUT LTP=12.30 (OI=850000)
Strike 23050: CALL LTP=220.75 (OI=1100000) | PUT LTP=15.80 (OI=920000)
Strike 23100: CALL LTP=198.25 (OI=980000) | PUT LTP=19.50 (OI=1050000)
Strike 23150: CALL LTP=177.90 (OI=890000) | PUT LTP=24.20 (OI=1180000)
Strike 23200: CALL LTP=159.40 (OI=820000) | PUT LTP=30.15 (OI=1320000)
... and 45 more strikes
────────────────────────────────────────────────────────────────────────────────
```

### Stopping the Client

Press `Ctrl+C` to gracefully stop the auto-refresh and exit.

### Prerequisites

- Ensure your API server is running (default: `http://localhost:3000`)
- The `/api/option-chain` endpoint must be available
- Valid access token configured in your API

### Error Handling

The client includes comprehensive error handling:
- Network errors are caught and logged
- API errors are displayed with details
- Graceful shutdown on SIGINT/SIGTERM signals
- Continues running even if individual requests fail

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build script (for Vercel)
- `npm run vercel-build` - Vercel build script
- `node stock-highlow-job.js` - Run the 52-week high/low job as a standalone server
- `node option-chain-client.js` - Run the option chain client with auto-refresh
- `node option-chain-client.js once` - Fetch option chain data once and exit

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - feel free to use this project for your own applications.

## Support

If you encounter any issues:
1. Check the Vercel deployment logs
2. Ensure all environment variables are set correctly
3. Verify Node.js version compatibility
4. Check the API endpoints are working locally first

---

**Happy coding! 🚀**
