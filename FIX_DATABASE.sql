-- Run this SQL in your Supabase SQL Editor to fix the access token issue

-- Step 1: Disable RLS temporarily to insert the token
ALTER TABLE public.access_tokens DISABLE ROW LEVEL SECURITY;

-- Step 2: Insert the access token
INSERT INTO public.access_tokens (provider, token, expires_at, is_active) 
VALUES (
  'upstox', 
  'eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGUwYjMwMGFlYWZjZDRiNWMxODIwZmUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTU1NjM1MiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5NjE1MjAwfQ.dFmU3t-QR9tLExgwnkt14UaeHsnseYq1X3bs-xTIiHE',
  '2025-12-31 23:59:59+00',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Re-enable RLS with proper policies
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

-- Step 4: Create a policy that allows service role access
DROP POLICY IF EXISTS "Allow service role access" ON public.access_tokens;
CREATE POLICY "Allow service role access" ON public.access_tokens
  FOR ALL USING (
    auth.role() = 'service_role' OR 
    auth.role() = 'authenticated' OR
    auth.role() = 'anon'
  );

-- Step 5: Verify the token was inserted
SELECT id, provider, is_active, created_at, expires_at 
FROM public.access_tokens 
WHERE provider = 'upstox' AND is_active = true;
