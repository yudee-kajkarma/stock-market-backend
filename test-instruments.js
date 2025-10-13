// Test script to try different instrument keys and see which ones work
const axios = require('axios');

const testInstruments = async () => {
  const baseUrl = 'http://localhost:3000';
  
  // Different sets of instruments to try
  const testSets = [
    {
      name: "Index Instruments (Known Working)",
      instruments: ["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"],
      mode: "ltpc"
    },
    {
      name: "Index Instruments Full Mode", 
      instruments: ["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"],
      mode: "full"
    },
    {
      name: "Options Set 1 (Current Month)",
      instruments: ["NSE_FO|60907", "NSE_FO|45450", "NSE_FO|50904"],
      mode: "full"
    },
    {
      name: "Options Set 1 (Greeks Mode)",
      instruments: ["NSE_FO|60907", "NSE_FO|45450", "NSE_FO|50904"],
      mode: "option_greeks"
    },
    {
      name: "Options Set 2 (Alternative Keys)",
      instruments: ["NSE_FO|45451", "NSE_FO|45452", "NSE_FO|45453"],
      mode: "full"
    },
    {
      name: "Options Set 2 (Greeks Mode)",
      instruments: ["NSE_FO|45451", "NSE_FO|45452", "NSE_FO|45453"],
      mode: "option_greeks"
    },
    {
      name: "Mixed Instruments",
      instruments: ["NSE_INDEX|Nifty 50", "NSE_FO|60907", "NSE_EQ|INE002A01018"],
      mode: "full"
    }
  ];

  console.log('🧪 Starting instrument tests...\n');

  for (const testSet of testSets) {
    try {
      console.log(`📊 Testing: ${testSet.name}`);
      console.log(`   Instruments: ${testSet.instruments.join(', ')}`);
      console.log(`   Mode: ${testSet.mode}`);
      
      const response = await axios.post(`${baseUrl}/test/subscribe`, {
        instrumentKeys: testSet.instruments,
        mode: testSet.mode
      });
      
      console.log(`   ✅ Subscription sent: ${response.data.message}`);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🏁 All tests completed. Check the server logs for data reception.');
};

// Check server status first
const checkStatus = async () => {
  try {
    const response = await axios.get('http://localhost:3000/test/status');
    console.log('📊 Server Status:', response.data);
    
    if (response.data.data.optionsConnected) {
      console.log('✅ Server is connected, starting tests...\n');
      await testInstruments();
    } else {
      console.log('❌ Server not connected. Starting connection...');
      await axios.get('http://localhost:3000/test/start');
      console.log('🔄 Waiting for connection...');
      setTimeout(testInstruments, 3000);
    }
  } catch (error) {
    console.error('❌ Failed to connect to test server:', error.message);
    console.log('💡 Make sure the options-test.js server is running on port 3000');
  }
};

checkStatus();
