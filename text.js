const axios = require('axios');

const url = 'https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX%7CNifty%2050';
const headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGRhMjQyNmM3MTBlYzNiNjk2OTVhY2IiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTEyNjU2NiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5MTgzMjAwfQ.9yoqJ4SD9nB6arcB8XLQeZkQWkAYGPPrOQaRHDgpBb0'
};

axios.get(url, { headers })
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });