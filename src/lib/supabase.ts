import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the app has credentials to talk to Supabase at all. Checked once at
 * the top of the tree so a fresh clone shows setup instructions instead of a
 * blank screen and a module-load exception.
 */
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Crew stay signed in on their own phone — asking a rigger to log in
        // at 6am every morning is how a system stops getting used.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as SupabaseClient)
