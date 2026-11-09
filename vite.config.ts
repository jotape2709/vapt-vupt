import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em `npm run dev`, /api e /auth vão para a API local (npm run dev:api com APP_ORIGIN=http://localhost:5173),
// mantendo cookies e CSRF no mesmo domínio. Sem a API, a demonstração (/demo) continua funcionando.
const api = process.env.VV_API_URL ?? 'http://127.0.0.1:3001';
export default defineConfig({
 plugins: [react()],
 build: { outDir: 'dist' },
 server: { proxy: { '/api': { target: api }, '/auth': { target: api } } }
});
