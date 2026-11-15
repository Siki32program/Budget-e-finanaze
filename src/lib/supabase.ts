import { createClient } from '@supabase/supabase-js';

// Dedicated private Supabase project "budget-finanze" (eu-central-1)
// Protected via PostgreSQL Row Level Security (auth.uid() = user_id)
const DEFAULT_SUPABASE_URL = 'https://roayzhbdllwmihgoriky.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvYXl6aGJkbGx3bWloZ29yaWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjMxNDAsImV4cCI6MjExMDMzOTE0MH0.bzOhUUs44mEbBH751pkpshdKSarejKgD0gXmFbbuuI4';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'siki-budget-supabase-auth',
  },
});
