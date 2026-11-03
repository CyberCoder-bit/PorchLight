// Local (Node) configuration: reads environment variables (and an optional .env file).
//
// Everything has a safe default so `npm start` works with zero setup.
// See README.md -> "MOCK_MODE vs LIVE_MODE" for the AI settings.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAppConfig, toInt } from './app-config.js';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tiny .env loader (KEY=value lines, # comments). We write our own instead of
// using the `dotenv` package so the app has no required dependencies.
// Real environment variables always win over values in the file.
export function loadDotEnv(file = path.join(ROOT_DIR, '.env')) {
  if (!fs.existsSync(file)) return false;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

// Build the config object from an env-like object (defaults to process.env).
// Tests pass their own object so they never depend on the developer's machine.
// The app settings themselves live in app-config.js so the Worker can share them.
export function buildConfig(env = process.env) {
  return {
    ...buildAppConfig(env),
    port: toInt(env.PORT, 3000, 0, 65535),
    host: env.HOST || '127.0.0.1',
    dataFile: env.DATA_FILE ? path.resolve(env.DATA_FILE) : path.join(ROOT_DIR, 'data', 'db.json'),
  };
}
