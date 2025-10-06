# Quick Start Guide

## Error: "Cannot coerce the result to a single JSON object"

If you're seeing this error, it means the access_tokens table exists but has no data. Follow these steps to fix it:

### Step 1: Create your .env file
```bash
cp env.example .env
```

Edit `.env` with your actual Supabase credentials:
```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 2: Create the database table
Run this SQL in your Supabase SQL Editor:
```sql
CREATE TABLE access_tokens (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'upstox',
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_access_tokens_provider_active ON access_tokens(provider, is_active);
```

### Step 3: Insert your access token

#### Option A: Using the helper script (Recommended)
```bash
node insert-token.js "your_actual_upstox_token_here"
```

#### Option B: Using SQL
```sql
INSERT INTO access_tokens (provider, token, expires_at, is_active) 
VALUES (
  'upstox', 
  'your_actual_upstox_token_here',
  '2025-12-31 23:59:59+00',
  true
);
```

#### Option C: Using the API endpoint
```bash
curl -X POST http://localhost:3001/api/token/update \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your_actual_upstox_token_here",
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

### Step 4: Test the setup
```bash
# Test the token
curl http://localhost:3001/api/token/test

# Check token info
curl http://localhost:3001/api/token/info

# Start the WebSocket connection
curl http://localhost:3001/start
```

## Current Token in Your Code

I can see you have this token in your code:
```
eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGUwYjMwMGFlYWZjZDRiNWMxODIwZmUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTU1NjM1MiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5NjE1MjAwfQ.dFmU3t-QR9tLExgwnkt14UaeHsnseYq1X3bs-xTIiHE
```

You can use this token to get started:
```bash
node insert-token.js "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGUwYjMwMGFlYWZjZDRiNWMxODIwZmUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTU1NjM1MiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5NjE1MjAwfQ.dFmU3t-QR9tLExgwnkt14UaeHsnseYq1X3bs-xTIiHE"
```

## What Changed

✅ **Access tokens are now stored in Supabase database**
✅ **Automatic token caching for better performance**  
✅ **Token expiration checking**
✅ **API endpoints for token management**
✅ **Both main app and highlow job use database tokens**
✅ **Fallback to environment variables if database fails**

## Benefits

- 🔒 **More secure**: No hardcoded tokens in code
- 🔄 **Dynamic updates**: Change tokens without redeploying
- ⏰ **Expiration tracking**: Automatic token validation
- 📊 **Better monitoring**: Track token usage and updates
- 🚀 **Easy management**: API endpoints for token operations
