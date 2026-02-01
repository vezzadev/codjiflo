/**
 * Tracing Infrastructure
 *
 * OTel-aligned structured logging for debugging and observability.
 * Ready for future migration to real OpenTelemetry SDK.
 *
 * Usage:
 * ```typescript
 * import { tracer, SemanticAttributes } from '@/lib/tracing';
 *
 * const span = tracer.startSpan('operation.name', {
 *   [SemanticAttributes.GITHUB_PR_NUMBER]: 123,
 * });
 * span.addEvent('checkpoint.reached');
 * span.setStatus('ok');
 * span.end();
 * ```
 */

export { SemanticAttributes } from './attributes';
export type { Attributes, AttributeValue, AttributeKey } from './attributes';
export type { Span, SpanContext, SpanEvent } from './span';
export { tracer } from './tracer';
