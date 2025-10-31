const axios = require('axios');

const url = 'https://api.upstox.com/v2/option/chain';
const params = {
    instrument_key: 'NSE_INDEX|Nifty 50',
    expiry_date: '2025-11-25'
};
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OTA0OGM1NjVjNDY4NzU2OTcyOGMzNDQiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc2MTkwNTc1MCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzYxOTQ4MDAwfQ.1FmKxQxNuQKk02zu6KPDJBpwHrIo4ThROR5vw3M0hjU'
};

axios.get(url, { params, headers })
    .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
    })
    .catch(error => {
        console.error('Error:', error);
    });
