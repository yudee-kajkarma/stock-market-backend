#!/usr/bin/env node

/**
 * Helper script to insert an access token into the database
 * Usage: node insert-token.js <your_access_token> [expires_at]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials are missing. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertToken(token, expiresAt = null) {
  try {
    console.log('🔄 Saving access token to database...');
    
    // Check if a row already exists for upstox provider
    const { data: existingToken, error: selectError } = await supabase
      .from('access_tokens')
      .select('id')
      .eq('provider', 'upstox')
      .limit(1)
      .single();

    let result;
    
    if (existingToken && !selectError) {
      // Update the existing row
      console.log('🔄 Updating existing access token...');
      const { data, error } = await supabase
        .from('access_tokens')
        .update({
          token: token,
          expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingToken.id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating token:', error);
        process.exit(1);
      }
      
      result = data;
      console.log('✅ Successfully updated access token');
    } else {
      // Insert the first token
      console.log('➕ Inserting first access token...');
      const { data, error } = await supabase
        .from('access_tokens')
        .insert({
          provider: 'upstox',
          token: token,
          expires_at: expiresAt,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting token:', error);
        process.exit(1);
      }
      
      result = data;
      console.log('✅ Successfully inserted access token');
    }

    console.log('📋 Token info:', {
      id: result.id,
      provider: result.provider,
      expires_at: result.expires_at,
      created_at: result.created_at,
      updated_at: result.updated_at
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to save token:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node insert-token.js <access_token> [expires_at]

Examples:
  node insert-token.js "eyJ0eXAiOiJKV1Q..."
  node insert-token.js "eyJ0eXAiOiJKV1Q..." "2025-12-31T23:59:59Z"

Note: Make sure to create your .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  `);
  process.exit(1);
}

const token = args[0];
const expiresAt = args[1] || null;

if (!token) {
  console.error('❌ Access token is required');
  process.exit(1);
}

insertToken(token, expiresAt);
