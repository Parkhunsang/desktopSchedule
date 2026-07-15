import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Returns the initialized Supabase client singleton, or null if settings are not configured.
 */
export function getSupabaseClient() {
  if (supabase) return supabase;

  const savedSettings = localStorage.getItem("desktop_scheduler_settings");
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      const url = parsed.supabaseUrl;
      const key = parsed.supabaseKey;

      if (url && key) {
        const cleanedUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '').trim();
        supabase = createClient(cleanedUrl, key);
        return supabase;
      }
    } catch (e) {
      console.error("Failed to parse settings for Supabase client", e);
    }
  }
  return null;
}
