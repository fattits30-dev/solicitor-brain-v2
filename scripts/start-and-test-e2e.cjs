// Script: scripts/start-and-test-e2e.cjs
// Starts the dev server, waits for it to be ready, then runs Playwright e2e tests.
const { spawn } = require('child_process');
const http = require('http');

const SERVER_URL = 'http://localhost:3333/api/health';
const WAIT_TIMEOUT = 30000; // 30s
const WAIT_INTERVAL = 1000; // 1s

function waitForServer(url, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(url, res => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    }
    function retry() {
      if (Date.now() - start > timeout) reject(new Error('Timeout waiting for server'));
      else setTimeout(check, WAIT_INTERVAL);
    }
    check();
  });
}

async function main() {
  const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
  try {
    await waitForServer(SERVER_URL, WAIT_TIMEOUT);
    console.log('✅ Dev server ready, running Playwright tests...');
    const e2e = spawn('npx', ['playwright', 'test'], { stdio: 'inherit' });
    e2e.on('exit', code => process.exit(code));
  } catch (err) {
    console.error('❌', err.message);
    dev.kill();
    process.exit(1);
  }
}

main();