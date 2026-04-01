/**
 * Structured Logger
 *
 * Replaces console.log/error/warn with structured JSON output in production
 * and pretty-printed output in development. All backend services use this
 * instead of raw console methods.
 */

import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? 1;
const isProduction = env.NODE_ENV === 'production';

interface LogEntry {
  level: LogLevel;
  service: string;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }
  // Dev: pretty format
  const { level, service, msg, ts, ...extra } = entry;
  const extraStr = Object.keys(extra).length > 0
    ? ' ' + JSON.stringify(extra)
    : '';
  return `${ts} [${level.toUpperCase()}] [${service}] ${msg}${extraStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

/**
 * Create a logger scoped to a service name.
 *
 * Usage:
 *   const log = createLogger('SolanaKeeper');
 *   log.info('Cycle complete', { walletsProcessed: 42, durationMs: 150 });
 */
export function createLogger(service: string): Logger {
  function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;
    const entry: LogEntry = {
      level,
      service,
      msg,
      ts: new Date().toISOString(),
      ...extra,
    };
    const output = formatLog(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  return {
    debug: (msg, extra) => log('debug', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  };
}
