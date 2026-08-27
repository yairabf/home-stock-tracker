import { ConsoleLogger, type LogLevel } from '@nestjs/common';

const LEVELS_BY_THRESHOLD: Record<string, LogLevel[]> = {
  fatal: ['fatal'],
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  log: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
  verbose: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
};

export function parseLogLevels(value: string | undefined): LogLevel[] {
  const configuredLevel = value ?? 'log';
  const levels = LEVELS_BY_THRESHOLD[configuredLevel];

  if (!levels) {
    throw new Error(
      `LOG_LEVEL must be one of: ${Object.keys(LEVELS_BY_THRESHOLD).join(', ')}`,
    );
  }

  return levels;
}

export function createApplicationLogger(
  value: string | undefined = process.env.LOG_LEVEL,
): ConsoleLogger {
  return new ConsoleLogger({
    json: true,
    logLevels: parseLogLevels(value),
  });
}
