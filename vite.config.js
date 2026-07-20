import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Custom check for local.env file
  const localEnvPath = path.resolve(process.cwd(), 'local.env');
  if (fs.existsSync(localEnvPath)) {
    const content = fs.readFileSync(localEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=').trim();
        const cleanKey = key.trim();
        if (cleanKey) {
          process.env[cleanKey] = val;
        }
      }
    });
  }

  const kmaKey = process.env.VITE_KMA_SERVICE_KEY || process.env.KMA_SERVICE_KEY || env.VITE_KMA_SERVICE_KEY || env.KMA_SERVICE_KEY || '';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

  return {
    base: './',
    envPrefix: ['VITE_', 'KMA_', 'SUPABASE_'],
    define: {
      'import.meta.env.VITE_KMA_SERVICE_KEY': JSON.stringify(kmaKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
    }
  };
});
