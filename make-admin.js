#!/usr/bin/env node

/**
 * Admin management script
 *
 * Usage:
 *   node make-admin.js <email>              - Promote user to admin + approve
 *   node make-admin.js --approve <email>    - Approve a user (keep their role)
 *   node make-admin.js --reject <email>     - Reject a user
 *   node make-admin.js --list               - List all users and their status
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials are missing. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list users:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`\nFound ${data.length} user(s):\n`);
  console.log('%-40s %-25s %-10s %-10s', 'EMAIL', 'NAME', 'ROLE', 'STATUS');
  console.log('-'.repeat(90));

  data.forEach((user) => {
    console.log(
      '%-40s %-25s %-10s %-10s',
      user.email || '-',
      user.full_name || '-',
      user.role || 'member',
      user.status || 'pending'
    );
  });
  console.log('');
}

async function findUser(email) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, role, status')
    .eq('email', email)
    .limit(1)
    .single();

  if (error || !data) {
    console.error(`User with email "${email}" not found.`);
    console.log('Run: node make-admin.js --list  to see all users.');
    process.exit(1);
  }

  return data;
}

async function makeAdmin(email) {
  const user = await findUser(email);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: 'admin',
      status: 'approved',
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to make admin:', error.message);
    process.exit(1);
  }

  console.log(`"${email}" is now an approved admin.`);
}

async function approveUser(email) {
  const user = await findUser(email);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      status: 'approved',
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to approve user:', error.message);
    process.exit(1);
  }

  console.log(`"${email}" has been approved (role: ${user.role || 'member'}).`);
}

async function rejectUser(email) {
  const user = await findUser(email);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      status: 'rejected',
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to reject user:', error.message);
    process.exit(1);
  }

  console.log(`"${email}" has been rejected.`);
}

// Parse args
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage:
  node make-admin.js <email>              Make user an admin + approve
  node make-admin.js --approve <email>    Approve a pending user
  node make-admin.js --reject <email>     Reject a user
  node make-admin.js --list               List all users
  `);
  process.exit(0);
}

(async () => {
  if (args[0] === '--list') {
    await listUsers();
  } else if (args[0] === '--approve') {
    if (!args[1]) {
      console.error('Email required. Usage: node make-admin.js --approve user@example.com');
      process.exit(1);
    }
    await approveUser(args[1]);
  } else if (args[0] === '--reject') {
    if (!args[1]) {
      console.error('Email required. Usage: node make-admin.js --reject user@example.com');
      process.exit(1);
    }
    await rejectUser(args[1]);
  } else {
    await makeAdmin(args[0]);
  }
  process.exit(0);
})();
