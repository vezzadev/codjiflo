import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from './useLayoutStore';

describe('useLayoutStore', () => {
  beforeEach(() => {
    // Clear localStorage first to ensure clean state
    localStorage.clear();

    // Reset the store state completely using setState
    useLayoutStore.setState({
      leftPaneWidth: 330,
      bottomPaneHeight: 200,
      isLeftPaneCollapsed: false,
      isBottomPaneCollapsed: false,
      lastLeftPaneWidth: 330,
      lastBottomPaneHeight: 200,
    });
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

    it('clamps width to maximum of 2000', () => {
      useLayoutStore.getState().setLeftPaneWidth(2500);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(2000);
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

    it('clamps height to maximum of 2000', () => {
      useLayoutStore.getState().setBottomPaneHeight(2500);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(2000);
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
      useLayoutStore.getState().setLeftPaneWidth(1980);
      useLayoutStore.getState().resizeLeftPane(50);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(2000);
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
      useLayoutStore.getState().setBottomPaneHeight(1980);
      useLayoutStore.getState().resizeBottomPane(-50);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(2000);
    });

    it('handles zero delta', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().resizeBottomPane(0);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(300);
    });
  });

  describe('left pane collapse/expand', () => {
    it('has initial collapsed state of false', () => {
      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(false);
    });

    it('collapses left pane and stores last width', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().collapseLeftPane();

      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(true);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(0);
      expect(useLayoutStore.getState().lastLeftPaneWidth).toBe(400);
    });

    it('expands left pane to last width', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().collapseLeftPane();
      useLayoutStore.getState().expandLeftPane();

      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(false);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(400);
    });

    it('uses default width when expanding with no stored last width', () => {
      // Collapse from default, then expand
      useLayoutStore.getState().collapseLeftPane();
      useLayoutStore.getState().expandLeftPane();

      expect(useLayoutStore.getState().leftPaneWidth).toBe(330);
    });

    it('does nothing when collapsing already collapsed pane', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().collapseLeftPane();
      // Collapse again - should keep the stored width
      useLayoutStore.getState().collapseLeftPane();

      expect(useLayoutStore.getState().lastLeftPaneWidth).toBe(400);
    });

    it('does nothing when expanding already expanded pane', () => {
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().expandLeftPane();

      expect(useLayoutStore.getState().leftPaneWidth).toBe(400);
      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(false);
    });
  });

  describe('bottom pane collapse/expand', () => {
    it('has initial collapsed state of false', () => {
      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(false);
    });

    it('collapses bottom pane and stores last height', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().collapseBottomPane();

      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(true);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(0);
      expect(useLayoutStore.getState().lastBottomPaneHeight).toBe(300);
    });

    it('expands bottom pane to last height', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().collapseBottomPane();
      useLayoutStore.getState().expandBottomPane();

      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(false);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(300);
    });

    it('uses default height when expanding with no stored last height', () => {
      useLayoutStore.getState().collapseBottomPane();
      useLayoutStore.getState().expandBottomPane();

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(200);
    });

    it('does nothing when collapsing already collapsed pane', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().collapseBottomPane();
      useLayoutStore.getState().collapseBottomPane();

      expect(useLayoutStore.getState().lastBottomPaneHeight).toBe(300);
    });

    it('does nothing when expanding already expanded pane', () => {
      useLayoutStore.getState().setBottomPaneHeight(300);
      useLayoutStore.getState().expandBottomPane();

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(300);
      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(false);
    });
  });

  describe('extended resize limits', () => {
    it('allows left pane to resize beyond old max of 600', () => {
      useLayoutStore.getState().setLeftPaneWidth(1000);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(1000);
    });

    it('allows bottom pane to resize beyond old max of 500', () => {
      useLayoutStore.getState().setBottomPaneHeight(800);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(800);
    });
  });

  describe('auto-collapse on resize', () => {
    it('auto-collapses left pane when resized below threshold', () => {
      // Start at minimum (200px) and resize with large negative delta
      useLayoutStore.getState().setLeftPaneWidth(200);
      // Resize to bring it below collapse threshold (50px): 200 - 180 = 20
      useLayoutStore.getState().resizeLeftPane(-180);

      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(true);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(0);
      expect(useLayoutStore.getState().lastLeftPaneWidth).toBe(200);
    });

    it('auto-collapses bottom pane when resized below threshold', () => {
      // Start at minimum (100px) and resize with large positive delta
      useLayoutStore.getState().setBottomPaneHeight(100);
      // Resize down to bring it below collapse threshold: 100 - 80 = 20
      useLayoutStore.getState().resizeBottomPane(80);

      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(true);
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(0);
      expect(useLayoutStore.getState().lastBottomPaneHeight).toBe(100);
    });

    it('does not auto-collapse when staying above threshold', () => {
      useLayoutStore.getState().setLeftPaneWidth(300);
      // Resize to 200 (above threshold), should clamp to min, not collapse
      useLayoutStore.getState().resizeLeftPane(-100);

      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(false);
      expect(useLayoutStore.getState().leftPaneWidth).toBe(200);
    });

    it('resizes normally when collapsed pane is already expanded', () => {
      // Collapse and expand, then resize
      useLayoutStore.getState().setLeftPaneWidth(400);
      useLayoutStore.getState().collapseLeftPane();
      useLayoutStore.getState().expandLeftPane();
      useLayoutStore.getState().resizeLeftPane(50);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(450);
      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(false);
    });
  });
});
