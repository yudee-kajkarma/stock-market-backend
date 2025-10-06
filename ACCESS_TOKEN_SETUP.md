# Access Token Management Setup Guide

This guide explains how to set up and manage access tokens using Supabase database storage instead of hardcoded tokens.

## Overview

The application now stores access tokens in a Supabase database table, providing better security and token management capabilities. This allows for:

- Dynamic token updates without code changes
- Token expiration tracking
- Multiple provider support
- Centralized token management via API endpoints

## Setup Instructions

### 1. Create the Database Table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create access_tokens table for storing API access tokens
CREATE TABLE access_tokens (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'upstox',
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on provider and is_active for faster queries
CREATE INDEX idx_access_tokens_provider_active ON access_tokens(provider, is_active);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow service role access
CREATE POLICY "Allow service role access" ON access_tokens
  FOR ALL USING (auth.role() = 'service_role');
```

### 2. Configure Environment Variables

Create a `.env` file from `env.example`:

```bash
cp env.example .env
```

Update the `.env` file with your credentials:

```env
NODE_ENV=development
PORT=3001

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Insert Your Access Token

You can insert your access token using either SQL or the API endpoint:

#### Option A: Using SQL
```sql
INSERT INTO access_tokens (provider, token, expires_at, is_active) 
VALUES (
  'upstox', 
  'your_actual_access_token_here',
  '2025-12-31 23:59:59+00',  -- Set appropriate expiration
  true
);
```

#### Option B: Using API Endpoint
```bash
curl -X POST http://localhost:3001/api/token/update \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your_actual_access_token_here",
    "expires_at": "2025-12-31T23:59:59Z",
    "provider": "upstox"
  }'
```

## API Endpoints

### Get Token Information
```bash
GET /api/token/info
```
Returns information about the current active access token (without exposing the actual token).

### Update Access Token
```bash
POST /api/token/update
Content-Type: application/json

{
  "token": "new_access_token",
  "expires_at": "2025-12-31T23:59:59Z",  // Optional
  "provider": "upstox"  // Optional, defaults to 'upstox'
}
```

### Test Access Token
```bash
GET /api/token/test
```
Tests the current access token by making a call to the Upstox API.

## Features

### Token Caching
- Tokens are cached in memory for 5 minutes to reduce database calls
- Cache is automatically cleared when tokens are updated

### Automatic Token Validation
- Checks token expiration before use
- Provides clear error messages for expired or missing tokens

### Multiple Provider Support
- Designed to support multiple API providers (currently configured for Upstox)
- Easy to extend for other stock market APIs

### Error Handling
- Comprehensive error handling with detailed logging
- Graceful fallback mechanisms

## Migration from Hardcoded Tokens

If you're migrating from the previous hardcoded token system:

1. Follow the setup instructions above
2. Insert your existing token into the database
3. Remove any hardcoded tokens from your code
4. Test the system using the `/api/token/test` endpoint

## Security Considerations

- Use Supabase Row Level Security (RLS) policies
- Store tokens securely in the database
- Use service role key for server-side operations
- Regularly rotate access tokens
- Monitor token expiration dates

## Troubleshooting

### Common Issues

1. **"No active access token found"**
   - Check if you've inserted a token into the database
   - Verify the token is marked as `is_active = true`

2. **"Access token has expired"**
   - Update the token with a new one
   - Check the `expires_at` field in the database

3. **"Supabase credentials are missing"**
   - Verify your `.env` file has the correct Supabase credentials
   - Check that the environment variables are loaded properly

4. **Database connection errors**
   - Verify your Supabase URL and service role key
   - Check your Supabase project is active and accessible

### Logs and Monitoring

The application provides detailed console logs for:
- Token fetching operations
- Cache usage
- Database operations
- API authorization attempts
- Error conditions

Monitor these logs to ensure proper token management and identify any issues.
