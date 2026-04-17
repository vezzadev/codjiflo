/**
 * CodeMirror 6 Mock Library for Vitest/JSDOM Testing
 *
 * Provides mock implementations of CodeMirror classes and functions
 * that work in jsdom without requiring contenteditable support.
 */

import { vi } from 'vitest';

// ============================================================================
// @codemirror/state mocks
// ============================================================================

/**
 * Mock StateEffect - used to define effects that can be dispatched
 */
export class MockStateEffect<T> {
  constructor(
    public readonly value: T,
    private readonly type: MockStateEffectType<T>
  ) {}

  is<U>(type: MockStateEffectType<U>): this is MockStateEffect<U> {
    return this.type === (type as unknown);
  }
}

export class MockStateEffectType<T> {
  static nextId = 0;
  private _id = MockStateEffectType.nextId++;

  of(value: T): MockStateEffect<T> {
    void this._id; // Used for unique instance identification
    return new MockStateEffect(value, this);
  }
}

export const StateEffect = {
  define: <T>(): MockStateEffectType<T> => new MockStateEffectType<T>(),
  reconfigure: new MockStateEffectType<unknown>(),
};

/**
 * Mock StateField - used to define state that persists across transactions
 */
export class MockStateField<T> {
  constructor(
    private config: {
      create: (state: MockEditorState) => T;
      update: (value: T, tr: MockTransaction) => T;
      provide?: (field: MockStateField<T>) => unknown;
    }
  ) {}

  init(create: (state: MockEditorState) => T): MockStateField<T> {
    return new MockStateField({
      ...this.config,
      create,
    });
  }

  static define<T>(config: {
    create: (state: MockEditorState) => T;
    update: (value: T, tr: MockTransaction) => T;
    provide?: (field: MockStateField<T>) => unknown;
  }): MockStateField<T> {
    return new MockStateField(config);
  }
}

export const StateField = MockStateField;

/**
 * Mock Facet - used for extension configuration
 */
export class MockFacet<Input, Output> {
  constructor(
    private _config?: {
      combine?: (values: Input[]) => Output;
    }
  ) {
    void this._config; // Config stored for potential future use
  }

  of(value: Input): MockFacetProvider<Input> {
    return new MockFacetProvider(this, value);
  }

  static define<Input, Output = readonly Input[]>(config?: {
    combine?: (values: Input[]) => Output;
  }): MockFacet<Input, Output> {
    return new MockFacet(config);
  }
}

export class MockFacetProvider<Input> {
  constructor(
    public facet: MockFacet<Input, unknown>,
    public value: Input
  ) {}
}

export const Facet = MockFacet;

/**
 * Mock Text/Document
 */
export class MockText {
  constructor(private content: string) {}

  get length(): number {
    return this.content.length;
  }

  get lines(): number {
    return this.content.split('\n').length;
  }

  line(n: number): { from: number; to: number; number: number; text: string } {
    const lines = this.content.split('\n');
    let from = 0;
    for (let i = 1; i < n; i++) {
      from += (lines[i - 1]?.length ?? 0) + 1;
    }
    const text = lines[n - 1] ?? '';
    return {
      from,
      to: from + text.length,
      number: n,
      text,
    };
  }

  lineAt(pos: number): { from: number; to: number; number: number; text: string } {
    const lines = this.content.split('\n');
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i]?.length ?? 0;
      if (currentPos + lineLength >= pos || i === lines.length - 1) {
        return {
          from: currentPos,
          to: currentPos + lineLength,
          number: i + 1,
          text: lines[i] ?? '',
        };
      }
      currentPos += lineLength + 1;
    }
    return { from: 0, to: 0, number: 1, text: '' };
  }

  toString(): string {
    return this.content;
  }

  static of(content: string | string[]): MockText {
    const text = Array.isArray(content) ? content.join('\n') : content;
    return new MockText(text);
  }
}

export const Text = MockText;

/**
 * Mock Transaction
 */
export class MockTransaction {
  constructor(
    public readonly state: MockEditorState,
    public readonly effects: MockStateEffect<unknown>[] = [],
    public readonly docChanged = false
  ) {}
}

/**
 * Mock EditorState
 */
export class MockEditorState {
  private fieldValues: Map<MockStateField<unknown>, unknown> = new Map();
  private facetValues: Map<MockFacet<unknown, unknown>, unknown[]> = new Map();

  constructor(
    public readonly doc: MockText,
    private extensions: unknown[] = []
  ) {}

  field<T>(field: MockStateField<T>, required?: boolean): T | undefined {
    const value = this.fieldValues.get(field as MockStateField<unknown>);
    if (value === undefined && required) {
      throw new Error('Field not found');
    }
    return value as T | undefined;
  }

  facet<Input, Output>(facet: MockFacet<Input, Output>): Output {
    const values = this.facetValues.get(facet as MockFacet<unknown, unknown>) ?? [];
    return values as unknown as Output;
  }

  update(spec: {
    effects?: MockStateEffect<unknown> | MockStateEffect<unknown>[];
    changes?: unknown;
  }): { state: MockEditorState } {
    // Effects are parsed but not used in mock - just validate the structure
    const _effects = spec.effects
      ? Array.isArray(spec.effects)
        ? spec.effects
        : [spec.effects]
      : [];
    void _effects;

    const newState = new MockEditorState(this.doc, this.extensions);
    newState.fieldValues = new Map(this.fieldValues);
    newState.facetValues = new Map(this.facetValues);

    return { state: newState };
  }

  static create(config: {
    doc?: string | MockText;
    extensions?: unknown[];
  }): MockEditorState {
    const doc = config.doc instanceof MockText
      ? config.doc
      : MockText.of(config.doc ?? '');
    return new MockEditorState(doc, config.extensions ?? []);
  }
}

export const EditorState = MockEditorState;

/**
 * Mock RangeSetBuilder
 */
export class MockRangeSetBuilder<T> {
  private ranges: { from: number; to: number; value: T }[] = [];

  add(from: number, to: number, value: T): this {
    this.ranges.push({ from, to, value });
    return this;
  }

  finish(): MockRangeSet<T> {
    return new MockRangeSet(this.ranges);
  }
}

export class MockRangeSet<T> {
  constructor(private ranges: { from: number; to: number; value: T }[] = []) {}

  iter(from?: number): MockRangeIterator<T> {
    return new MockRangeIterator(this.ranges, from);
  }

  static empty = new MockRangeSet([]);
}

export class MockRangeIterator<T> {
  private index = 0;

  constructor(
    private ranges: { from: number; to: number; value: T }[],
    from?: number
  ) {
    if (from !== undefined) {
      while (this.index < ranges.length && (ranges[this.index]?.to ?? 0) < from) {
        this.index++;
      }
    }
  }

  get value(): T | null {
    return this.ranges[this.index]?.value ?? null;
  }

  get from(): number {
    return this.ranges[this.index]?.from ?? 0;
  }

  get to(): number {
    return this.ranges[this.index]?.to ?? 0;
  }

  next(): void {
    this.index++;
  }
}

export const RangeSetBuilder = MockRangeSetBuilder;
export const RangeSet = MockRangeSet;

// ============================================================================
// @codemirror/view mocks
// ============================================================================

/**
 * Mock Decoration
 */
export class MockDecoration {
  constructor(public readonly spec: { [key: string]: unknown }) {}

  static line(spec: { class?: string; attributes?: { [key: string]: string } }): MockDecoration {
    return new MockDecoration({ ...spec, type: 'line' });
  }

  static mark(spec: { class?: string; attributes?: { [key: string]: string } }): MockDecoration {
    return new MockDecoration({ ...spec, type: 'mark' });
  }

  static widget(spec: {
    widget: MockWidgetType;
    block?: boolean;
    side?: number;
  }): MockDecoration {
    return new MockDecoration({ ...spec, type: 'widget' });
  }

  static none = MockRangeSet.empty;
}

export const Decoration = MockDecoration;

/**
 * Mock DecorationSet (alias for RangeSet<Decoration>)
 */
export type DecorationSet = MockRangeSet<MockDecoration>;

/**
 * Mock WidgetType
 */
export abstract class MockWidgetType {
  abstract toDOM(view?: MockEditorView): HTMLElement;

  destroy?(dom: HTMLElement): void;

  eq(other: MockWidgetType): boolean {
    return this === other;
  }

  get estimatedHeight(): number {
    return -1;
  }

  ignoreEvent?(): boolean {
    return true;
  }
}

export const WidgetType = MockWidgetType;

/**
 * Mock EditorView
 */
export class MockEditorView {
  public state: MockEditorState;
  public scrollDOM: HTMLElement;
  public contentDOM: HTMLElement;
  public dom: HTMLElement;
  private updateListeners: ((update: MockViewUpdate) => void)[] = [];

  constructor(config?: {
    state?: MockEditorState;
    parent?: HTMLElement;
    dispatch?: (tr: MockTransaction) => void;
  }) {
    this.state = config?.state ?? MockEditorState.create({ doc: '' });

    // Create mock DOM elements
    this.dom = document.createElement('div');
    this.dom.className = 'cm-editor';

    this.scrollDOM = document.createElement('div');
    this.scrollDOM.className = 'cm-scroller';
    this.scrollDOM.scrollTop = 0;
    this.scrollDOM.scrollLeft = 0;
    Object.defineProperty(this.scrollDOM, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(this.scrollDOM, 'clientHeight', { value: 500, configurable: true });

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'cm-content';
    this.contentDOM.setAttribute('contenteditable', 'true');

    this.scrollDOM.appendChild(this.contentDOM);
    this.dom.appendChild(this.scrollDOM);

    if (config?.parent) {
      config.parent.appendChild(this.dom);
    }
  }

  get viewport(): { from: number; to: number } {
    return { from: 0, to: this.state.doc.length };
  }

  readonly documentTop = 0;

  dispatch(tr: MockTransaction | { effects?: MockStateEffect<unknown> | MockStateEffect<unknown>[] }): void {
    const trEffects = 'effects' in tr ? tr.effects : undefined;
    const effectsArray = trEffects
      ? Array.isArray(trEffects) ? trEffects : [trEffects]
      : [];

    // Transaction is constructed but not used - mock just updates state
    void (tr instanceof MockTransaction
      ? tr
      : new MockTransaction(this.state, effectsArray));

    const { state: newState } = this.state.update({ effects: effectsArray });
    this.state = newState;

    const update: MockViewUpdate = {
      view: this,
      state: newState,
      docChanged: false,
      viewportChanged: false,
      geometryChanged: false,
    };

    this.updateListeners.forEach(listener => listener(update));
  }

  coordsAtPos(pos: number): { top: number; bottom: number; left: number; right: number } | null {
    const lineHeight = 20;
    const line = this.state.doc.lineAt(pos);
    return {
      top: (line.number - 1) * lineHeight,
      bottom: line.number * lineHeight,
      left: 0,
      right: 100,
    };
  }

  lineBlockAtHeight(height: number): { from: number; to: number; top: number; bottom: number } {
    const lineHeight = 20;
    const lineNumber = Math.floor(height / lineHeight) + 1;
    const line = this.state.doc.line(Math.min(lineNumber, this.state.doc.lines));
    return {
      from: line.from,
      to: line.to,
      top: (line.number - 1) * lineHeight,
      bottom: line.number * lineHeight,
    };
  }

  destroy(): void {
    this.dom.remove();
  }

  focus(): void {
    this.contentDOM.focus();
  }

  static updateListener = {
    of: (listener: (update: MockViewUpdate) => void) => ({
      type: 'updateListener',
      listener,
    }),
  };

  static baseTheme(spec: { [key: string]: { [key: string]: string } }): unknown {
    return { type: 'theme', spec };
  }

  static decorations = {
    from: <T>(field: MockStateField<T>, getter: (value: T) => DecorationSet) => ({
      type: 'decorationProvider',
      field,
      getter,
    }),
  };
}

export const EditorView = MockEditorView;

/**
 * Mock ViewUpdate
 */
export interface MockViewUpdate {
  view: MockEditorView;
  state: MockEditorState;
  docChanged: boolean;
  viewportChanged: boolean;
  geometryChanged: boolean;
}

export type ViewUpdate = MockViewUpdate;

/**
 * Mock ViewPlugin
 */
export class MockViewPlugin<T> {
  constructor(
    private _create: (view: MockEditorView) => T,
    private _spec?: {
      eventHandlers?: { [key: string]: (event: Event, view: MockEditorView) => boolean };
    }
  ) {
    void this._create;
    void this._spec;
  }

  static fromClass<T>(
    cls: new (view: MockEditorView) => T,
    spec?: {
      eventHandlers?: { [key: string]: (event: Event, view: MockEditorView) => boolean };
    }
  ): MockViewPlugin<T> {
    return new MockViewPlugin((view) => new cls(view), spec);
  }
}

export const ViewPlugin = MockViewPlugin;

/**
 * Mock keymap
 */
export interface MockKeyBinding {
  key?: string;
  mac?: string;
  run: (view: MockEditorView) => boolean;
  shift?: (view: MockEditorView) => boolean;
  preventDefault?: boolean;
}

export type KeyBinding = MockKeyBinding;

export const keymap = {
  of: (bindings: MockKeyBinding[]): unknown => ({
    type: 'keymap',
    bindings,
  }),
};

/**
 * Mock highlightWhitespace
 */
export const highlightWhitespace = (): unknown => ({
  type: 'highlightWhitespace',
});

// ============================================================================
// Extension type
// ============================================================================

export type Extension = unknown;

// ============================================================================
// Setup function to apply mocks
// ============================================================================

/**
 * Apply CodeMirror mocks to vi.mock calls
 */
export function setupCodeMirrorMocks(): void {
  vi.mock('@codemirror/state', () => ({
    StateEffect,
    StateField,
    Facet,
    Text,
    EditorState,
    RangeSetBuilder,
    RangeSet,
  }));

  vi.mock('@codemirror/view', () => ({
    EditorView,
    Decoration,
    WidgetType,
    ViewPlugin,
    keymap,
    highlightWhitespace,
  }));
}

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Create a mock document for testing
 */
export function createMockDoc(content: string): MockText {
  return MockText.of(content);
}

/**
 * Create a mock EditorView for testing
 */
export function createMockEditorView(config?: {
  doc?: string;
  parent?: HTMLElement;
}): MockEditorView {
  const state = MockEditorState.create({ doc: config?.doc ?? '' });
  const viewConfig: { state: MockEditorState; parent?: HTMLElement } = { state };
  if (config?.parent) {
    viewConfig.parent = config.parent;
  }
  return new MockEditorView(viewConfig);
}

/**
 * Create a mock EditorState for testing
 */
export function createMockEditorState(config?: {
  doc?: string;
  extensions?: unknown[];
}): MockEditorState {
  return MockEditorState.create({
    doc: config?.doc ?? '',
    extensions: config?.extensions ?? [],
  });
}
