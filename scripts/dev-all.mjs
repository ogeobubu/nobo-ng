import { networkInterfaces } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const backendHost = '0.0.0.0';
const frontendHost = '127.0.0.1';
const backendBasePort = Number(process.env.BACKEND_PORT || 4000);
const frontendPort = Number(process.env.FRONTEND_PORT || 3000);
const mobileTarget = (process.env.MOBILE_TARGET || 'device').toLowerCase();

const isPortInUse = (port) => {
  const result = spawnSync('lsof', ['-iTCP:' + port, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  });

  if (result.error) {
    return false;
  }

  return Boolean(result.stdout.trim());
};

const findAvailablePort = (startPort) => {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (!isPortInUse(port)) {
      return port;
    }
  }

  throw new Error(`No free port found starting at ${startPort}`);
};

const getLanIp = () => {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
};

const spawnWorkspace = (name, command, args, env) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env }
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
};

const bootstrap = async () => {
  const backendPort = await findAvailablePort(backendBasePort);
  const lanIp = getLanIp();
  const mobileApiBaseUrl =
    mobileTarget === 'ios' || mobileTarget === 'ios-simulator'
      ? `http://localhost:${backendPort}`
      : `http://${lanIp}:${backendPort}`;
  const mobileCommand = mobileTarget === 'ios' || mobileTarget === 'ios-simulator' ? 'ios' : 'start';

  console.log(`Using backend port ${backendPort}, frontend port ${frontendPort}, and mobile API ${mobileApiBaseUrl}`);
  console.log(`Frontend will proxy API requests to http://127.0.0.1:${backendPort}`);
  console.log(`Mobile target: ${mobileTarget}`);

  const children = [
    spawnWorkspace('backend', 'yarn', ['workspace', '@nobong/backend', 'dev'], {
      HOST: backendHost,
      PORT: String(backendPort)
    }),
    spawnWorkspace('frontend', 'yarn', ['workspace', '@nobong/frontend', 'dev'], {
      VITE_HOST: frontendHost,
      VITE_PORT: String(frontendPort),
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`
    }),
    spawnWorkspace('mobile', 'yarn', ['workspace', '@nobong/mobile', mobileCommand], {
      EXPO_PUBLIC_API_BASE_URL: mobileApiBaseUrl
    })
  ];

  const shutdown = () => {
    for (const child of children) {
      child.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

bootstrap().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
