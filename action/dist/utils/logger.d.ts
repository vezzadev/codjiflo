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
declare const logger: pino.Logger<never, boolean>;
export { logger };
//# sourceMappingURL=logger.d.ts.map