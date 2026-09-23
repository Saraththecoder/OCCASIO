import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  demoChannelId: process.env.DEMO_CHANNEL_ID || '@demo_storefront',
};

// Check if credentials are valid/mocked
export const isSupabaseConfigured = Boolean(
  config.supabaseUrl &&
  config.supabaseUrl !== 'https://mock.supabase.co' &&
  config.supabaseAnonKey &&
  config.supabaseAnonKey !== 'mock_anon_key'
);

export const isGeminiConfigured = Boolean(
  config.geminiApiKey &&
  config.geminiApiKey !== 'mock_gemini_key'
);

export const isTelegramConfigured = Boolean(
  config.telegramBotToken &&
  config.telegramBotToken !== 'mock_telegram_token'
);

// Supabase Client
export const supabase = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

// Gemini AI Client
export const genAI = isGeminiConfigured
  ? new GoogleGenerativeAI(config.geminiApiKey)
  : null;

// Telegram Bot Instance (Long Polling for local dev / hackathon demo simplicity)
export let bot = null;

if (isTelegramConfigured) {
  try {
    bot = new TelegramBot(config.telegramBotToken, { polling: true });
    console.log('🤖 Telegram Bot initialized in polling mode');
  } catch (err) {
    console.error('❌ Failed to initialize Telegram Bot:', err.message);
  }
} else {
  console.warn('⚠️ Telegram Bot Token missing or mocked. Bot will run in passive mode.');
}
