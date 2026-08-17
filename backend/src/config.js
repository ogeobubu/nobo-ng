import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '..', '.env')
});

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCorsOrigin = (value) => {
  if (!value) {
    return 'http://localhost:5173';
  }

  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return 'http://localhost:5173';
  }

  if (origins.includes('*')) {
    return true;
  }

  return origins.length === 1 ? origins[0] : origins;
};

export const config = {
  port: toNumber(process.env.PORT, 4000),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: toNumber(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'nobong',
  dbConnectionLimit: toNumber(process.env.DB_CONNECTION_LIMIT, 10)
};
