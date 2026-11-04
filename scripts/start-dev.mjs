import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('[K-CHILL Dev] Starting Server & Client in background daemon mode...');

// 1. Start Express Server
const serverProc = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  cwd: root,
  shell: true,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PORT: '3001' }
});

serverProc.on('exit', (code) => {
  console.log(`[K-CHILL Dev] Server exited with code ${code}`);
});

// 2. Start Vite Client
const clientProc = spawn('npx', ['vite', '--host'], {
  cwd: root,
  shell: true,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, BROWSER: 'none', CI: '1' }
});

clientProc.on('exit', (code) => {
  console.log(`[K-CHILL Dev] Client exited with code ${code}`);
});

process.on('SIGINT', () => {
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
});
