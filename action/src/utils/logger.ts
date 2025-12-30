/**
 * OpenTelemetry-compatible Logger
 *
 * Uses pino with OTel semantic conventions for structured logging.
 * See: https://opentelemetry.io/docs/specs/otel/logs/semantic_conventions/
 */

import pino from 'pino';

/**
 * OTel severity levels mapped to pino levels
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ severity: label.toUpperCase() }),
  },
  messageKey: 'body',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    'service.name': 'codjiflo-action',
    'service.version': process.env.npm_package_version ?? '1.0.0',
  },
});

export { logger };
