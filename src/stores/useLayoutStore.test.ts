import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from './useLayoutStore';

describe('useLayoutStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const store = useLayoutStore.getState();
    // Manually reset to defaults since we can't access the initial state directly
    store.setLeftPaneWidth(330); // DEFAULT_LEFT_PANE_WIDTH
    store.setBottomPaneHeight(200); // DEFAULT_BOTTOM_PANE_HEIGHT
    // Clear localStorage to ensure clean state
    localStorage.clear();
  });

  describe('initial state', () => {
    it('has default left pane width of 330', () => {
      expect(useLayoutStore.getState().leftPaneWidth).toBe(330);
    });

    it('has default bottom pane height of 200', () => {
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(200);
    });
  });

  describe('setLeftPaneWidth', () => {
    it('sets left pane width within bounds', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(400);
    });

    it('clamps width to minimum of 200', () => {
      useLayoutStore.getState().setLeftPaneWidth(100);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(200);
    });

    it('clamps width to maximum of 600', () => {
      useLayoutStore.getState().setLeftPaneWidth(800);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(600);
    });

    it('accepts exact minimum value', () => {
      useLayoutStore.getState().setLeftPaneWidth(200);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(200);
    });

    it('accepts exact maximum value', () => {
      useLayoutStore.getState().setLeftPaneWidth(600);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(600);
    });
  });

  describe('setBottomPaneHeight', () => {
    it('sets bottom pane height within bounds', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(300);
    });

    it('clamps height to minimum of 100', () => {
      useLayoutStore.getState().setBottomPaneHeight(50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(100);
    });

    it('clamps height to maximum of 500', () => {
      useLayoutStore.getState().setBottomPaneHeight(700);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(500);
    });

    it('accepts exact minimum value', () => {
      useLayoutStore.getState().setBottomPaneHeight(100);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(100);
    });

    it('accepts exact maximum value', () => {
      useLayoutStore.getState().setBottomPaneHeight(500);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(500);
    });
  });

  describe('resizeLeftPane', () => {
    it('increases left pane width by positive delta', () => {
      useLayoutStore.getState().setLeftPaneWidth(300);
      useLayoutStore.getState().resizeLeftPane(50);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(350);
    });

    it('decreases left pane width by negative delta', () => {
      useLayoutStore.getState().setLeftPaneWidth(300);
      useLayoutStore.getState().resizeLeftPane(-50);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(250);
    });

    it('clamps result to minimum when delta would go below minimum', () => {
      useLayoutStore.getState().setLeftPaneWidth(220);
      useLayoutStore.getState().resizeLeftPane(-50);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(200);
    });

    it('clamps result to maximum when delta would go above maximum', () => {
      useLayoutStore.getState().setLeftPaneWidth(580);
      useLayoutStore.getState().resizeLeftPane(50);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(600);
    });

    it('handles zero delta', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().resizeLeftPane(0);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(400);
    });
  });

  describe('resizeBottomPane', () => {
    it('increases bottom pane height when delta is negative (resize up)', () => {
      useLayoutStore.getState().setBottomPaneHeight(200);
      useLayoutStore.getState().resizeBottomPane(-50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(250);
    });

    it('decreases bottom pane height when delta is positive (resize down)', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().resizeBottomPane(50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(250);
    });

    it('clamps result to minimum when delta would go below minimum', () => {
      useLayoutStore.getState().setBottomPaneHeight(120);
      useLayoutStore.getState().resizeBottomPane(50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(100);
    });

    it('clamps result to maximum when delta would go above maximum', () => {
      useLayoutStore.getState().setBottomPaneHeight(480);
      useLayoutStore.getState().resizeBottomPane(-50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(500);
    });

    it('handles zero delta', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().resizeBottomPane(0);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(300);
    });
  });
});
