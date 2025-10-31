/**
 * Quick test script for the option chain endpoint
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

async function testOptionChainEndpoint() {
  console.log('🧪 Testing Option Chain Endpoint\n');
  
  try {
    // Test 1: Default parameters
    console.log('Test 1: Fetching with default parameters...');
    const response1 = await axios.get(`${API_BASE_URL}/api/option-chain`);
    console.log('✅ Success:', response1.data.success);
    console.log('📊 Data points:', response1.data.data?.data?.length || 0);
    console.log('⏰ Timestamp:', response1.data.timestamp);
    console.log('');

    // Test 2: Custom parameters
    console.log('Test 2: Fetching with custom parameters...');
    const response2 = await axios.get(`${API_BASE_URL}/api/option-chain`, {
      params: {
        instrument_key: 'NSE_INDEX|Nifty Bank',
        expiry_date: '2025-11-25'
      }
    });
    console.log('✅ Success:', response2.data.success);
    console.log('📊 Data points:', response2.data.data?.data?.length || 0);
    console.log('⏰ Timestamp:', response2.data.timestamp);
    console.log('');

    // Test 3: Simplified endpoint
    console.log('Test 3: Testing simplified endpoint...');
    const response3 = await axios.get(`${API_BASE_URL}/option-chain`);
    console.log('✅ Success:', response3.data.success);
    console.log('📊 Data points:', response3.data.data?.data?.length || 0);
    console.log('⏰ Timestamp:', response3.data.timestamp);
    console.log('');

    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testOptionChainEndpoint();
