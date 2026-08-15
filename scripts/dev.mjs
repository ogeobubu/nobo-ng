import { spawn } from 'node:child_process';

const commands = [
  {
    name: 'backend',
    command: 'npm',
    args: ['run', 'dev', '-w', 'backend']
  },
  {
    name: 'frontend',
    command: 'npm',
    args: ['run', 'dev', '-w', 'frontend']
  }
];

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: false });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
