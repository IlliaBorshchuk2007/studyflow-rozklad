import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isConfigured = Boolean(
  url && key && url.startsWith('https://') && !url.includes('your-project') && !key.includes('YOUR_KEY'),
);

// Publishable key можна показувати в браузері. Secret/service_role key — НІ.
export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
