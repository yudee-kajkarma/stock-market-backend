-- Create access_tokens table for storing API access tokens
-- Run this SQL in your Supabase SQL Editor

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

-- Insert a sample token (replace with your actual token)
INSERT INTO access_tokens (provider, token, expires_at, is_active) 
VALUES (
  'upstox', 
  'eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGUwYjMwMGFlYWZjZDRiNWMxODIwZmUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTU1NjM1MiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5NjE1MjAwfQ.dFmU3t-QR9tLExgwnkt14UaeHsnseYq1X3bs-xTIiHE',
  '2025-12-31 23:59:59+00',
  true
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow service role access (adjust as needed)
CREATE POLICY "Allow service role access" ON access_tokens
  FOR ALL USING (auth.role() = 'service_role');
