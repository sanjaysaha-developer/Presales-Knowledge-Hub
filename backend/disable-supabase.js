// Temporarily disable Supabase to use SQLite
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';

console.log('Supabase temporarily disabled. APIs will use SQLite fallback.');
