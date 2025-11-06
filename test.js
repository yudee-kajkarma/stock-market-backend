const axios = require('axios');

const url = 'https://api.upstox.com/v2/option/chain';
const params = {
    instrument_key: 'NSE_INDEX|Nifty Fin Service',
    expiry_date: '2025-11-25'
};
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OTA1YzljN2Q3NjYyZTdhMTZjN2UxNTYiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc2MTk4NzAxNSwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzYyMDM0NDAwfQ.d63RGqehiNs1oErObHaD7igrjCut0Jz5jjfaRuUoAX0'
};

axios.get(url, { params, headers })
    .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
    })
    .catch(error => {
        console.error('Error:', error);
    });
