import dotenv from 'dotenv';
import { supabase } from './src/services/supabaseClient.js';

dotenv.config();

console.log('Testing Supabase connection...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Set (length: ' + process.env.SUPABASE_KEY.length + ')' : 'Not set');

async function testConnection() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
      console.log('❌ Connection test result:', error.message);
      if (error.message.includes('relation "public.users" does not exist')) {
        console.log('🔧 SOLUTION: You need to create the database tables in Supabase!');
        console.log('📋 Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
        console.log('📄 Run the SQL schema provided above.');
      }
    } else {
      console.log('✅ Connection successful! Found', data?.length || 0, 'records in users table');
    }
  } catch (err) {
    console.log('❌ Connection failed:', err.message);
  }
}

testConnection();
