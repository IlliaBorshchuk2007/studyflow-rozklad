import { createClient } from '@supabase/supabase-js';
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
export const isConfigured = url.startsWith('https://') && url.endsWith('.supabase.co') && key.length > 25 && !key.includes('YOUR_KEY');
export const supabase = isConfigured ? createClient(url, key, {auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }}) : null;
