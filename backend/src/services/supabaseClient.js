import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure .env is loaded even when this module is imported before server initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy supabase client when not configured to avoid fetch errors
let supabase;
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  // Create a mock client that won't make actual requests
  supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: new Error('Supabase not configured') }),
          order: () => ({
            range: () => ({ data: [], error: new Error('Supabase not configured') }),
          }),
        }),
        order: () => ({
          range: () => ({ data: [], error: new Error('Supabase not configured'), count: 0 }),
        }),
      }),
      insert: () => ({ data: null, error: new Error('Supabase not configured') }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: null, error: new Error('Supabase not configured') }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({ error: new Error('Supabase not configured') }),
      }),
      rpc: () => ({ data: null, error: new Error('Supabase not configured') }),
    }),
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };


