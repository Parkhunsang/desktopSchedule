import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  // If local.env exists, manually parse and inject it if needed
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

  // Find any KMA_SERVICE_KEY or VITE_KMA_SERVICE_KEY
  const kmaKey = process.env.VITE_KMA_SERVICE_KEY || process.env.KMA_SERVICE_KEY || env.VITE_KMA_SERVICE_KEY || env.KMA_SERVICE_KEY || '';

  return {
    base: './',
    envPrefix: ['VITE_', 'KMA_'],
    define: {
      'import.meta.env.VITE_KMA_SERVICE_KEY': JSON.stringify(kmaKey)
    }
  };
});

