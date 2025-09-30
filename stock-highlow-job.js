// Import required modules
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'highlow-job.log' })
  ]
});

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Supabase credentials are missing. Please check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Upstox API configuration
const UPSTOX_API_URL = 'https://api.upstox.com/v3/historical-candle/';
const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

// List of stock instruments to track
const INSTRUMENTS = [
  'NSE_EQ|INE002A01018', // RELIANCE
  'NSE_EQ|INE040A01034', // HDFC BANK
  'NSE_EQ|INE009A01021', // INFOSYS
  'NSE_EQ|INE030A01027', // BHARTI AIRTEL
  'NSE_EQ|INE062A01020'  // AXIS BANK
  // Add more instruments as needed
];

// Function to fetch historical data from Upstox
async function fetchHistoricalData(instrumentKey) {
  try {
    // Calculate date range for 52 weeks (365 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    // Format URL with path parameters
    // Format: /v3/historical-candle/:instrument_key/:unit/:interval/:to_date/:from_date
    const unit = 'days';
    const interval = '1';
    const toDate = formatDate(endDate);
    const fromDate = formatDate(startDate);
    
    const url = `${UPSTOX_API_URL}${instrumentKey}/${unit}/${interval}/${toDate}/${fromDate}`;
    
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    logger.info(`Fetching historical data for ${instrumentKey} from ${fromDate} to ${toDate}`);
    
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching historical data for ${instrumentKey}:`, error.message);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}, data:`, error.response.data);
    }
    throw error;
  }
}

// Function to calculate 52-week high and low
function calculate52WeekHighLow(data) {
  try {
    if (!data || !data.data || !data.data.candles || data.data.candles.length === 0) {
      throw new Error('Invalid or empty data received');
    }

    const candles = data.data.candles;
    
    // Initialize high and low with the first candle's high and low
    let high = candles[0][2]; // High value from first candle
    let low = candles[0][3];  // Low value from first candle
    
    // Iterate through all candles to find the highest high and lowest low
    for (const candle of candles) {
      const candleHigh = candle[2];
      const candleLow = candle[3];
      
      if (candleHigh > high) {
        high = candleHigh;
      }
      
      if (candleLow < low) {
        low = candleLow;
      }
    }
    
    return { high, low };
  } catch (error) {
    logger.error('Error calculating 52-week high/low:', error.message);
    throw error;
  }
}

// Function to save data to Supabase
async function saveToSupabase(instrumentKey, high, low) {
  try {
    logger.info(`Saving data for ${instrumentKey}: high=${high}, low=${low}`);
    
    const { data, error } = await supabase
      .from('stock_highlow')
      .upsert(
        {
          instrument_key: instrumentKey,
          high: high,
          low: low,
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'instrument_key',
          ignoreDuplicates: false
        }
      );
      
    if (error) {
      throw error;
    }
    
    logger.info(`Successfully saved data for ${instrumentKey}`);
    return data;
  } catch (error) {
    logger.error(`Error saving data to Supabase for ${instrumentKey}:`, error.message);
    throw error;
  }
}

// Function to process each instrument
async function processInstrument(instrumentKey) {
  try {
    // Fetch historical data
    const historicalData = await fetchHistoricalData(instrumentKey);
    
    // Calculate 52-week high and low
    const { high, low } = calculate52WeekHighLow(historicalData);
    
    // Save to Supabase
    await saveToSupabase(instrumentKey, high, low);
    
    return { instrumentKey, high, low };
  } catch (error) {
    logger.error(`Failed to process instrument ${instrumentKey}:`, error.message);
    return { instrumentKey, error: error.message };
  }
}

// Main function to run the job
async function runHighLowJob() {
  logger.info('Starting 52-week high/low job');
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Process each instrument sequentially to avoid rate limits
  for (const instrument of INSTRUMENTS) {
    try {
      const result = await processInstrument(instrument);
      if (result.error) {
        results.failed.push(result);
      } else {
        results.successful.push(result);
      }
    } catch (error) {
      results.failed.push({ instrumentKey: instrument, error: error.message });
    }
  }
  
  logger.info(`Job completed. Successfully processed: ${results.successful.length}, Failed: ${results.failed.length}`);
  return results;
}

// PRODUCTION SCHEDULE (COMMENTED OUT FOR TESTING)
// Set up scheduled job - 3:35 PM IST every weekday (Monday to Friday)
// IST is UTC+5:30, so 3:35 PM IST is 10:05 AM UTC
// cron.schedule('5 10 * * 1-5', async () => {
//   try {
//     logger.info('Running scheduled 52-week high/low job at 3:35 PM IST');
//     await runHighLowJob();
//     logger.info('Scheduled job completed');
//   } catch (error) {
//     logger.error('Error in scheduled job:', error);
//   }
// });

// TESTING SCHEDULE - Runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    logger.info(`[TEST MODE] Running scheduled 52-week high/low job at ${now.toISOString()}`);
    await runHighLowJob();
    logger.info('[TEST MODE] Scheduled job completed');
  } catch (error) {
    logger.error('[TEST MODE] Error in scheduled job:', error);
  }
});

// API endpoint to manually trigger the job
app.get('/run-highlow-job', async (req, res) => {
  try {
    logger.info('Manually triggered 52-week high/low job');
    const results = await runHighLowJob();
    res.json({ 
      status: 'success',
      message: 'Job completed',
      results
    });
  } catch (error) {
    logger.error('Error running manual job:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`[TEST MODE] 52-week high/low job scheduled to run EVERY MINUTE for testing`);
  logger.info(`[TEST MODE] Production schedule (3:35 PM IST) is commented out`);
});