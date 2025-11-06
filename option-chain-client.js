/**
 * Option Chain Client - Auto Refresh Example
 * 
 * This script demonstrates how to fetch option chain data
 * from the API endpoint every 2 seconds (or custom interval)
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const INSTRUMENT_KEY = 'NSE_INDEX|Nifty Bank';
const EXPIRY_DATE = '2025-11-25';
const REFRESH_INTERVAL = 2000; // 2 seconds in milliseconds

let intervalId = null;

/**
 * Fetch option chain data from the API
 */
async function fetchOptionChain(instrumentKey = INSTRUMENT_KEY, expiryDate = EXPIRY_DATE) {
  try {
    console.log(`\n📊 Fetching option chain for ${instrumentKey} (Expiry: ${expiryDate})...`);
    
    const response = await axios.get(`${API_BASE_URL}/api/option-chain`, {
      params: {
        instrument_key: instrumentKey,
        expiry_date: expiryDate
      }
    });

    if (response.data.success) {
      console.log('✅ Successfully fetched option chain data');
      console.log(`⏰ Timestamp: ${response.data.timestamp}`);
      
      // Process the data
      processOptionChainData(response.data.data);
      
      return response.data;
    } else {
      console.error('❌ Error:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to fetch option chain:', error.message);
    if (error.response) {
      console.error('Response error:', error.response.data);
    }
    return null;
  }
}

/**
 * Process and display option chain data
 */
function processOptionChainData(data) {
  if (!data || !data.data || data.data.length === 0) {
    console.log('⚠️  No option chain data available');
    return;
  }

  console.log(`\n📈 Option Chain Summary (${data.data.length} strikes):`);
  console.log('─'.repeat(80));
  
  // Display first 5 strikes as example
  const displayCount = Math.min(5, data.data.length);
  
  for (let i = 0; i < displayCount; i++) {
    const option = data.data[i];
    const strike = option.strike_price || 0;
    const callLTP = option.call_options?.market_data?.ltp || 0;
    const putLTP = option.put_options?.market_data?.ltp || 0;
    const callOI = option.call_options?.market_data?.oi || 0;
    const putOI = option.put_options?.market_data?.oi || 0;
    
    console.log(`Strike ${strike}: CALL LTP=${callLTP.toFixed(2)} (OI=${callOI}) | PUT LTP=${putLTP.toFixed(2)} (OI=${putOI})`);
  }
  
  if (data.data.length > displayCount) {
    console.log(`... and ${data.data.length - displayCount} more strikes`);
  }
  
  console.log('─'.repeat(80));
}

/**
 * Start auto-refresh with specified interval
 */
function startAutoRefresh(intervalMs = REFRESH_INTERVAL) {
  console.log(`\n🚀 Starting auto-refresh (every ${intervalMs / 1000} seconds)`);
  console.log('Press Ctrl+C to stop\n');
  
  // Fetch immediately
  fetchOptionChain();
  
  // Then set up interval
  intervalId = setInterval(() => {
    fetchOptionChain();
  }, intervalMs);
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('\n⏹️  Auto-refresh stopped');
  }
}

/**
 * Fetch once without auto-refresh
 */
async function fetchOnce(instrumentKey, expiryDate) {
  const result = await fetchOptionChain(instrumentKey, expiryDate);
  if (result) {
    console.log('\n✅ Fetch completed successfully');
  } else {
    console.log('\n❌ Fetch failed');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'once') {
  // Fetch once and exit
  const instrumentKey = args[1] || INSTRUMENT_KEY;
  const expiryDate = args[2] || EXPIRY_DATE;
  fetchOnce(instrumentKey, expiryDate);
} else if (command === 'auto') {
  // Auto-refresh mode
  const intervalMs = args[1] ? parseInt(args[1]) * 1000 : REFRESH_INTERVAL;
  startAutoRefresh(intervalMs);
} else {
  // Default: auto-refresh mode
  startAutoRefresh();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  stopAutoRefresh();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  stopAutoRefresh();
  process.exit(0);
});

// Export functions for use as module
module.exports = {
  fetchOptionChain,
  startAutoRefresh,
  stopAutoRefresh,
  fetchOnce
};
