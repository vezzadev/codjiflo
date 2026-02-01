/**
 * OTel-aligned Span Implementation
 *
 * ConsoleSpan logs structured JSON to console.debug on end().
 * This provides debugging capability and a clear path to OTel SDK migration.
 *
 * Output format matches OTel span structure:
 * - timestamp, traceId, spanId, parentSpanId
 * - name, duration_ms, attributes, events
 * - status, statusMessage
 */

import type { Attributes, AttributeValue } from './attributes';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Attributes;
}

export interface Span {
  setAttribute(key: string, value: AttributeValue): void;
  addEvent(name: string, attributes?: Attributes): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  getContext(): SpanContext;
  end(): void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export class ConsoleSpan implements Span {
  private readonly context: SpanContext;
  private readonly name: string;
  private readonly startTime: number;
  private readonly attributes: Attributes;
  private readonly events: SpanEvent[] = [];
  private status: 'ok' | 'error' = 'ok';
  private statusMessage?: string;

  constructor(name: string, attributes: Attributes = {}, parentContext?: SpanContext) {
    this.name = name;
    this.startTime = Date.now();
    this.attributes = { ...attributes };

    const baseContext: SpanContext = {
      traceId: parentContext?.traceId ?? generateId(),
      spanId: generateId(),
    };

    if (parentContext?.spanId) {
      baseContext.parentSpanId = parentContext.spanId;
    }

    this.context = baseContext;
  }

  setAttribute(key: string, value: AttributeValue): void {
    this.attributes[key] = value;
  }

  addEvent(name: string, attributes?: Attributes): void {
    const event: SpanEvent = {
      name,
      timestamp: Date.now(),
    };

    if (attributes) {
      event.attributes = attributes;
    }

    this.events.push(event);
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    this.status = status;
    if (message) {
      this.statusMessage = message;
    }
  }

  getContext(): SpanContext {
    return this.context;
  }

  end(): void {
    const data = {
      timestamp: this.startTime,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.context.parentSpanId,
      name: this.name,
      duration_ms: Date.now() - this.startTime,
      attributes: this.attributes,
      events: this.events,
      status: this.status,
      statusMessage: this.statusMessage,
    };
    console.debug(JSON.stringify(data));
  }
}
