import { defineConfig } from '@playwright/test';

// PLAYWRIGHT_CHROMIUM_PATH permite usar um Chromium já instalado (ex.: containers sem download).
// Sem a variável, o Playwright usa o navegador instalado por `npx playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
 testDir:'./tests/browser',fullyParallel:false,retries:0,
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',launchOptions:{executablePath}},
 webServer:{command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false},
 reporter:[['list']],
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
});
