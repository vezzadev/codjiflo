/**
 * Tests for OTel-aligned tracing infrastructure
 *
 * Tests cover:
 * - Span creation with attributes
 * - Attribute addition after creation
 * - Event recording
 * - Status setting (ok/error)
 * - Parent/child span relationships
 * - JSON structured logging on end()
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { tracer } from './tracer';
import type { Attributes } from './attributes';

/**
 * Shape of the JSON output logged by ConsoleSpan.end()
 */
interface SpanLogData {
  timestamp: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  duration_ms: number;
  attributes: Attributes;
  events: {
    name: string;
    timestamp: number;
    attributes?: Attributes;
  }[];
  status: 'ok' | 'error';
  statusMessage?: string;
}

/**
 * Parse the logged JSON from console.debug
 */
function parseSpanLog(spy: MockInstance, callIndex = 0): SpanLogData {
  const call = spy.mock.calls[callIndex];
  if (!call || typeof call[0] !== 'string') {
    throw new Error(`No log call at index ${callIndex}`);
  }
  return JSON.parse(call[0]) as SpanLogData;
}

describe('tracer', () => {
  let consoleSpy: MockInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('creates span with attributes and logs on end', () => {
    const span = tracer.startSpan('test.operation', {
      'test.attribute': 'value',
    });

    span.setAttribute('added.later', 123);
    span.addEvent('something.happened', { count: 5 });
    span.setStatus('ok');
    span.end();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = parseSpanLog(consoleSpy);

    expect(logged.name).toBe('test.operation');
    expect(logged.attributes['test.attribute']).toBe('value');
    expect(logged.attributes['added.later']).toBe(123);
    expect(logged.events).toHaveLength(1);
    const firstEvent = logged.events[0];
    expect(firstEvent).toBeDefined();
    expect(firstEvent?.name).toBe('something.happened');
    expect(logged.status).toBe('ok');
    expect(logged.traceId).toBeDefined();
    expect(logged.spanId).toBeDefined();
    expect(logged.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('supports error status with message', () => {
    const span = tracer.startSpan('failing.operation');
    span.setStatus('error', 'Something went wrong');
    span.end();

    const logged = parseSpanLog(consoleSpy);
    expect(logged.status).toBe('error');
    expect(logged.statusMessage).toBe('Something went wrong');
  });

  it('supports parent span context', () => {
    const parent = tracer.startSpan('parent.operation');
    const child = tracer.startSpan('child.operation', {}, parent.getContext());

    child.end();
    parent.end();

    const childLogged = parseSpanLog(consoleSpy, 0);
    const parentLogged = parseSpanLog(consoleSpy, 1);

    expect(childLogged.parentSpanId).toBe(parentLogged.spanId);
    expect(childLogged.traceId).toBe(parentLogged.traceId);
  });

  it('generates unique span IDs', () => {
    const span1 = tracer.startSpan('operation.1');
    const span2 = tracer.startSpan('operation.2');

    span1.end();
    span2.end();

    const logged1 = parseSpanLog(consoleSpy, 0);
    const logged2 = parseSpanLog(consoleSpy, 1);

    expect(logged1.spanId).not.toBe(logged2.spanId);
  });

  it('generates unique trace IDs for independent spans', () => {
    const span1 = tracer.startSpan('operation.1');
    const span2 = tracer.startSpan('operation.2');

    span1.end();
    span2.end();

    const logged1 = parseSpanLog(consoleSpy, 0);
    const logged2 = parseSpanLog(consoleSpy, 1);

    expect(logged1.traceId).not.toBe(logged2.traceId);
  });

  it('logs timestamp in output', () => {
    const beforeStart = Date.now();
    const span = tracer.startSpan('test.operation');
    span.end();
    const afterEnd = Date.now();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.timestamp).toBeGreaterThanOrEqual(beforeStart);
    expect(logged.timestamp).toBeLessThanOrEqual(afterEnd);
  });

  it('records event with timestamp and attributes', () => {
    const span = tracer.startSpan('test.operation');
    const beforeEvent = Date.now();
    span.addEvent('test.event', { key: 'value', num: 42 });
    const afterEvent = Date.now();
    span.end();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.events).toHaveLength(1);
    const event = logged.events[0];
    expect(event).toBeDefined();
    expect(event?.name).toBe('test.event');
    expect(event?.timestamp).toBeGreaterThanOrEqual(beforeEvent);
    expect(event?.timestamp).toBeLessThanOrEqual(afterEvent);
    expect(event?.attributes).toEqual({ key: 'value', num: 42 });
  });

  it('records multiple events', () => {
    const span = tracer.startSpan('test.operation');
    span.addEvent('event.1');
    span.addEvent('event.2', { data: 'test' });
    span.addEvent('event.3');
    span.end();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.events).toHaveLength(3);
    expect(logged.events[0]?.name).toBe('event.1');
    expect(logged.events[1]?.name).toBe('event.2');
    expect(logged.events[2]?.name).toBe('event.3');
  });

  it('defaults status to ok', () => {
    const span = tracer.startSpan('test.operation');
    span.end();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.status).toBe('ok');
    expect(logged.statusMessage).toBeUndefined();
  });

  it('supports all attribute value types', () => {
    const span = tracer.startSpan('test.operation', {
      'string.attr': 'hello',
      'number.attr': 42,
      'boolean.attr': true,
      'string.array': ['a', 'b', 'c'],
      'number.array': [1, 2, 3],
    });
    span.end();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.attributes['string.attr']).toBe('hello');
    expect(logged.attributes['number.attr']).toBe(42);
    expect(logged.attributes['boolean.attr']).toBe(true);
    expect(logged.attributes['string.array']).toEqual(['a', 'b', 'c']);
    expect(logged.attributes['number.array']).toEqual([1, 2, 3]);
  });

  it('does not include parentSpanId when no parent', () => {
    const span = tracer.startSpan('root.operation');
    span.end();

    const logged = parseSpanLog(consoleSpy);

    expect(logged.parentSpanId).toBeUndefined();
  });
});
