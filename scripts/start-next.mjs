import { spawn } from 'node:child_process';

const port = process.env.PORT || '10000';
const hostname = process.env.HOSTNAME || '0.0.0.0';

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'start', '-H', hostname, '-p', port],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: port,
      HOSTNAME: hostname,
    },
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});
