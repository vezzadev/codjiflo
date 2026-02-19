/**
 * Unit tests for ThemeModal component
 *
 * Tests rendering, user interactions, and accessibility features
 * of the theme settings modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeModal } from './ThemeModal';
import { useThemeStore } from '../stores/useThemeStore';

describe('ThemeModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    act(() => {
      useThemeStore.setState({
        theme: 'light',
        diffColorScheme: 'codeflow-classic',
        useHighContrastDiff: false,
      });
    });
  });

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <ThemeModal isOpen={false} onClose={mockOnClose} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders modal when open', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Appearance Settings')).toBeInTheDocument();
    });

    it('renders UI Theme section with all options', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('UI Theme')).toBeInTheDocument();
      expect(screen.getByLabelText('Light')).toBeInTheDocument();
      expect(screen.getByLabelText('Dark')).toBeInTheDocument();
      expect(screen.getByLabelText('Black')).toBeInTheDocument();
      expect(screen.getByLabelText('High Contrast')).toBeInTheDocument();
    });

    it('renders Diff Colors section with all schemes', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Diff Colors')).toBeInTheDocument();
      expect(screen.getByLabelText(/GitHub Default/)).toBeInTheDocument();
      expect(screen.getByLabelText(/GitHub Protanopia/)).toBeInTheDocument();
      expect(screen.getByLabelText(/GitHub Tritanopia/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Visual Studio/)).toBeInTheDocument();
      expect(screen.getByLabelText(/CodeFlow Classic/)).toBeInTheDocument();
      expect(screen.getByLabelText(/CodeFlow Red\/Green/)).toBeInTheDocument();
    });

    it('renders Contrast section with preview panels', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Contrast')).toBeInTheDocument();
      expect(screen.getByLabelText(/Regular/)).toBeInTheDocument();
      // "High Contrast" appears twice: once in UI Theme, once in preview panel
      const hcLabels = screen.getAllByLabelText(/High Contrast/);
      expect(hcLabels).toHaveLength(2);
    });

    it('renders close button', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('reflects current theme state', () => {
      act(() => {
        useThemeStore.setState({ theme: 'dark' });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const darkRadio = screen.getByLabelText('Dark');
      expect(darkRadio).toBeChecked();
    });

    it('reflects current diff color scheme state', () => {
      act(() => {
        useThemeStore.setState({ diffColorScheme: 'visual-studio' });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const vsRadio = screen.getByLabelText(/Visual Studio/);
      expect(vsRadio).toBeChecked();
    });

    it('reflects high contrast diff state', () => {
      act(() => {
        useThemeStore.setState({ useHighContrastDiff: true });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // The high contrast preview panel radio should be checked
      // Get all radio buttons with "High Contrast" - second one is the preview panel
      const hcRadios = screen.getAllByRole('radio', { name: /High Contrast/ });
      const previewHcRadio = hcRadios[1]; // Preview panel radio
      expect(previewHcRadio).toBeChecked();
    });
  });

  describe('interactions', () => {
    it('changes UI theme when radio is selected', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText('Dark'));

      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('changes diff color scheme when radio is selected', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText(/GitHub Default/));

      expect(useThemeStore.getState().diffColorScheme).toBe('github');
    });

    it('enables high contrast diff when preview panel is selected', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // Get all radio buttons with "High Contrast" - second one is the preview panel
      const hcRadios = screen.getAllByRole('radio', { name: /High Contrast/ });
      const previewHcRadio = hcRadios[1]; // Preview panel radio
      if (previewHcRadio) {
        fireEvent.click(previewHcRadio);
      }

      expect(useThemeStore.getState().useHighContrastDiff).toBe(true);
    });

    it('disables high contrast diff when Regular is selected', () => {
      act(() => {
        useThemeStore.setState({ useHighContrastDiff: true });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const regularRadio = screen.getByLabelText(/Regular/);
      fireEvent.click(regularRadio);

      expect(useThemeStore.getState().useHighContrastDiff).toBe(false);
    });

    it('calls onClose when close button is clicked', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // The backdrop has aria-hidden="true" and className "modal-backdrop"
      const backdrop = document.querySelector('.modal-backdrop');
      expect(backdrop).toBeInTheDocument();
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for other keys', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct aria attributes on modal', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'theme-modal-title');
    });

    it('has accessible title', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const title = screen.getByText('Appearance Settings');
      expect(title).toHaveAttribute('id', 'theme-modal-title');
    });

    it('backdrop is hidden from screen readers', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      const backdrop = document.querySelector('.modal-backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('preview panels', () => {
    it('renders diff preview with code lines', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // Check for code preview content
      expect(screen.getAllByText(/function example/)).toHaveLength(2);
      expect(screen.getAllByText('oldValue')).toHaveLength(2);
      expect(screen.getAllByText('newValue')).toHaveLength(2);
    });

    it('applies correct diff class based on theme and scheme', () => {
      act(() => {
        useThemeStore.setState({
          theme: 'dark',
          diffColorScheme: 'github',
          useHighContrastDiff: false,
        });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // Find preview panels and verify they have the right class
      const previewPanels = document.querySelectorAll('.preview-panel');
      expect(previewPanels.length).toBeGreaterThan(0);

      // One panel should have diff-github-dark class (regular)
      const regularPanel = Array.from(previewPanels).find((p) =>
        p.className.includes('diff-github-dark')
      );
      expect(regularPanel).toBeInTheDocument();

      // One panel should have diff-github-dark-hc class (high contrast)
      const hcPanel = Array.from(previewPanels).find((p) =>
        p.className.includes('diff-github-dark-hc')
      );
      expect(hcPanel).toBeInTheDocument();
    });

    it('uses correct suffix for high-contrast UI theme', () => {
      act(() => {
        useThemeStore.setState({
          theme: 'high-contrast',
          diffColorScheme: 'github',
          useHighContrastDiff: false,
        });
      });

      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // High-contrast theme should use 'dark' suffix
      const previewPanels = document.querySelectorAll('.preview-panel');
      const regularPanel = Array.from(previewPanels).find((p) =>
        p.className.includes('diff-github-dark')
      );
      expect(regularPanel).toBeInTheDocument();
    });

    it('marks selected preview panel', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      // By default, high contrast is off, so Regular should be selected
      const selectedPanels = document.querySelectorAll('.preview-panel-selected');
      expect(selectedPanels).toHaveLength(1);
    });
  });

  describe('theme cycling', () => {
    it('allows changing through all UI themes', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText('Light'));
      expect(useThemeStore.getState().theme).toBe('light');

      fireEvent.click(screen.getByLabelText('Dark'));
      expect(useThemeStore.getState().theme).toBe('dark');

      fireEvent.click(screen.getByLabelText('Black'));
      expect(useThemeStore.getState().theme).toBe('black');

      fireEvent.click(screen.getByLabelText('High Contrast'));
      expect(useThemeStore.getState().theme).toBe('high-contrast');
    });

    it('allows changing through all diff schemes', () => {
      render(<ThemeModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText(/GitHub Default/));
      expect(useThemeStore.getState().diffColorScheme).toBe('github');

      fireEvent.click(screen.getByLabelText(/Visual Studio/));
      expect(useThemeStore.getState().diffColorScheme).toBe('visual-studio');

      fireEvent.click(screen.getByLabelText(/CodeFlow Classic/));
      expect(useThemeStore.getState().diffColorScheme).toBe('codeflow-classic');
    });
  });
});
