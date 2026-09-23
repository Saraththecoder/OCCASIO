import { config, bot, supabase } from './src/config.js';

async function diagnose() {
  console.log('🔍 Running Connection Diagnostics...\n');

  // 1. Check Telegram Bot Token
  if (bot) {
    try {
      const me = await bot.getMe();
      console.log(`✅ [Telegram Bot] Connected successfully! Bot username: @${me.username}`);
    } catch (err) {
      console.error(`❌ [Telegram Bot Error]:`, err.message);
    }
  } else {
    console.log('⚠️ Telegram bot not configured.');
  }

  // 2. Check Supabase Database Tables
  if (supabase) {
    console.log(`\n🔍 Checking Supabase connection to: ${config.supabaseUrl}`);
    const { data: shops, error: shopsErr } = await supabase.from('shops').select('count', { count: 'exact' });

    if (shopsErr) {
      if (shopsErr.message.includes('schema cache') || shopsErr.code === '42P01') {
        console.error('❌ [Supabase Error]: Tables do NOT exist in your Supabase database yet.');
        console.error('👉 You need to run the SQL script from `schema.sql` in your Supabase SQL Editor.');
      } else {
        console.error('❌ [Supabase Error]:', shopsErr.message);
      }
    } else {
      console.log('✅ [Supabase DB] Connected! `shops` table exists.');
    }
  }

  process.exit(0);
}

diagnose();
