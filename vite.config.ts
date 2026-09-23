import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {relayPlugin} from './server/relay';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  process.env.DASHSCOPE_API_KEY = env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY;
  process.env.TYPESAFE_API_KEY = env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY;
  process.env.JEV_API_KEY = env.JEV_API_KEY || process.env.JEV_API_KEY;
  process.env.TYPESAFE_BASE_URL = env.TYPESAFE_BASE_URL || process.env.TYPESAFE_BASE_URL;
  process.env.JEV_MODEL = env.JEV_MODEL || process.env.JEV_MODEL;
  return {
    base: '/',
    plugins: [react(), tailwindcss(), relayPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
