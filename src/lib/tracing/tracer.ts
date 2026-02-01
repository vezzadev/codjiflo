/**
 * OTel-aligned Tracer
 *
 * Factory for creating spans. Currently uses ConsoleSpan for
 * structured logging. Can be swapped for real OTel SDK later.
 */

import type { Attributes } from './attributes';
import type { Span, SpanContext } from './span';
import { ConsoleSpan } from './span';

export interface Tracer {
  startSpan(name: string, attributes?: Attributes, parentContext?: SpanContext): Span;
}

class ConsoleTracer implements Tracer {
  startSpan(name: string, attributes?: Attributes, parentContext?: SpanContext): Span {
    return new ConsoleSpan(name, attributes, parentContext);
  }
}

export const tracer: Tracer = new ConsoleTracer();
