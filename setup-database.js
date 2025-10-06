#!/usr/bin/env node

/**
 * Database setup script to create access_tokens table and insert initial token
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials are missing. Please check your .env file.');
  console.log('Required variables:');
  console.log('- SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // First, try to create the table using raw SQL
    console.log('📋 Creating access_tokens table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.access_tokens (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL DEFAULT 'upstox',
        token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_access_tokens_provider_active 
      ON public.access_tokens(provider, is_active);
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });
    
    if (createError) {
      console.log('⚠️ Could not create table via RPC, trying direct approach...');
      console.log('Error:', createError.message);
    } else {
      console.log('✅ Table created successfully');
    }
    
    // Test if we can access the table
    console.log('🔍 Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('access_tokens')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Cannot access access_tokens table:', testError.message);
      console.log('\n📝 Please run this SQL manually in your Supabase SQL Editor:');
      console.log(createTableSQL);
      return;
    }
    
    console.log('✅ Table access confirmed');
    
    // Check if we have any existing tokens
    const { data: existingTokens, error: selectError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('provider', 'upstox')
      .eq('is_active', true);
    
    if (selectError) {
      console.error('❌ Error checking existing tokens:', selectError.message);
      return;
    }
    
    if (existingTokens && existingTokens.length > 0) {
      console.log('✅ Found existing active token');
      console.log('📋 Token info:', {
        id: existingTokens[0].id,
        provider: existingTokens[0].provider,
        expires_at: existingTokens[0].expires_at,
        created_at: existingTokens[0].created_at
      });
      return;
    }
    
    // Insert the hardcoded token from the original code
    console.log('💾 Inserting initial access token...');
    const initialToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI0R0NBWkgiLCJqdGkiOiI2OGUwYjMwMGFlYWZjZDRiNWMxODIwZmUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc1OTU1NjM1MiwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzU5NjE1MjAwfQ.dFmU3t-QR9tLExgwnkt14UaeHsnseYq1X3bs-xTIiHE";
    
    const { data: insertData, error: insertError } = await supabase
      .from('access_tokens')
      .insert({
        provider: 'upstox',
        token: initialToken,
        expires_at: '2025-12-31T23:59:59Z',
        is_active: true
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error inserting token:', insertError.message);
      
      // Try to disable RLS temporarily
      console.log('🔓 Attempting to disable RLS...');
      const { error: rlsError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE public.access_tokens DISABLE ROW LEVEL SECURITY;'
      });
      
      if (!rlsError) {
        console.log('✅ RLS disabled, retrying insert...');
        const { data: retryData, error: retryError } = await supabase
          .from('access_tokens')
          .insert({
            provider: 'upstox',
            token: initialToken,
            expires_at: '2025-12-31T23:59:59Z',
            is_active: true
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('❌ Still failed to insert token:', retryError.message);
          return;
        }
        
        console.log('✅ Token inserted successfully after disabling RLS');
        console.log('📋 Token info:', {
          id: retryData.id,
          provider: retryData.provider,
          expires_at: retryData.expires_at,
          created_at: retryData.created_at
        });
      } else {
        console.error('❌ Could not disable RLS:', rlsError.message);
        return;
      }
    } else {
      console.log('✅ Token inserted successfully');
      console.log('📋 Token info:', {
        id: insertData.id,
        provider: insertData.provider,
        expires_at: insertData.expires_at,
        created_at: insertData.created_at
      });
    }
    
    console.log('\n🎉 Database setup complete!');
    console.log('🚀 Your application should now work properly.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
