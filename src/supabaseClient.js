import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Returns the initialized Supabase client singleton.
 * Checks environment variables (.env / Cloudflare env) first, then localStorage fallback.
 */
export function getSupabaseClient() {
  if (supabase) return supabase;

  // 1. Try environment variables first
  const envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

  if (envUrl && envKey && envUrl.trim() && envKey.trim()) {
    try {
      const cleanedUrl = envUrl.replace(/(\/rest\/v1\/?|\/auth\/v1\/?|\/)+$/g, '').trim();
      supabase = createClient(cleanedUrl, envKey.trim());
      return supabase;
    } catch (e) {
      console.warn("Failed to initialize Supabase from environment variables:", e);
    }
  }

  // 2. Try localStorage fallback
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
