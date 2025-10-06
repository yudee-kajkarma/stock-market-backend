# Deployment Checklist

## Pre-Deployment Requirements

### Environment Variables
Ensure these environment variables are set in your deployment platform:

- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- [ ] `PORT` - (Optional, defaults to 3001)
- [ ] `NODE_ENV` - Set to "production" for production deployments

### Database Setup
- [ ] Supabase project created and configured
- [ ] `access_tokens` table created using `create-access-tokens-table.sql`
- [ ] Valid Upstox access token inserted into the database

### Files Required
- [ ] `MarketDataFeedV3.proto` - Protobuf definition file
- [ ] `package.json` with all dependencies
- [ ] `index.js` - Main application file

## Render.com Specific Steps

### 1. Environment Variables Setup
1. Go to Render dashboard → Your service → Environment
2. Add required environment variables:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 2. Build Settings
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Node Version**: >= 18.0.0 (specified in package.json)

### 3. Post-Deployment Verification
- [ ] Check deployment logs for "Supabase credentials are missing" errors
- [ ] Verify WebSocket connection to Upstox
- [ ] Test API endpoints:
  - `GET /status` - Check connection status
  - `GET /api/token/info` - Verify token access
  - `GET /start` - Start WebSocket connection

## Common Issues & Solutions

### "Supabase credentials are missing"
- **Cause**: Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
- **Solution**: Add environment variables in deployment platform

### "No active access token found"
- **Cause**: No valid token in `access_tokens` table
- **Solution**: Insert token using `POST /api/token/update` endpoint

### WebSocket connection failures
- **Cause**: Expired or invalid Upstox access token
- **Solution**: Update token in database and restart service

## Security Notes
- Never commit `.env` files to version control
- Use service role key (not anon key) for server-side operations
- Regularly rotate access tokens
- Monitor token expiration dates

## Monitoring
- Check application logs regularly
- Monitor WebSocket connection status
- Set up alerts for token expiration
- Track API response times and error rates
