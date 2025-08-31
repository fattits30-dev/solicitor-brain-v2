// Script: scripts/dev-with-logs.cjs
// Starts the dev server and writes all stdout/stderr to dev-server.log
const { spawn } = require('child_process');
const fs = require('fs');

const logStream = fs.createWriteStream('dev-server.log', { flags: 'a' });
const dev = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'] });

dev.stdout.pipe(logStream);
dev.stderr.pipe(logStream);

dev.stdout.on('data', data => process.stdout.write(data));
dev.stderr.on('data', data => process.stderr.write(data));

dev.on('exit', code => {
  logStream.write(`\n[dev server exited with code ${code}]\n`);
  logStream.end();
  process.exit(code);
});
