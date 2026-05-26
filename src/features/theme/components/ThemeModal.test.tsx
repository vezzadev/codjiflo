/**
 * Unit tests for ThemeModal component (react-aria Modal-backed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { ThemeModal } from './ThemeModal';
import { useThemeStore } from '../stores/useThemeStore';

describe('ThemeModal', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useThemeStore.setState({
        theme: 'light',
        diffColorScheme: 'codeflow-classic',
        useHighContrastDiff: false,
      });
    });
  });

  it('renders nothing when closed', () => {
    render(<ThemeModal isOpen={false} onOpenChange={mockOnOpenChange} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when open with accessible name from title', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Appearance Settings');
  });

  it('renders UI Theme section with all options', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText('UI Theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Light')).toBeInTheDocument();
    expect(screen.getByLabelText('Dark')).toBeInTheDocument();
    expect(screen.getByLabelText('Black')).toBeInTheDocument();
    expect(screen.getByLabelText('High Contrast')).toBeInTheDocument();
  });

  it('renders Diff Colors section with all schemes', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText('Diff Colors')).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Default/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Protanopia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Tritanopia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Visual Studio/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CodeFlow Classic/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CodeFlow Red\/Green/)).toBeInTheDocument();
  });

  it('renders Contrast section with preview panels', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText('Contrast')).toBeInTheDocument();
    expect(screen.getByLabelText(/Regular/)).toBeInTheDocument();
    const hcLabels = screen.getAllByLabelText(/High Contrast/);
    expect(hcLabels).toHaveLength(2);
  });

  it('renders close button', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('reflects current theme state', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByLabelText('Dark')).toBeChecked();
  });

  it('reflects current diff color scheme state', () => {
    act(() => {
      useThemeStore.setState({ diffColorScheme: 'visual-studio' });
    });
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByLabelText(/Visual Studio/)).toBeChecked();
  });

  it('reflects high contrast diff state', () => {
    act(() => {
      useThemeStore.setState({ useHighContrastDiff: true });
    });
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const hcRadios = screen.getAllByRole('radio', { name: /High Contrast/ });
    const previewHcRadio = hcRadios[1];
    expect(previewHcRadio).toBeChecked();
  });

  it('changes UI theme when radio is selected', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByLabelText('Dark'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('changes diff color scheme when radio is selected', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByLabelText(/GitHub Default/));
    expect(useThemeStore.getState().diffColorScheme).toBe('github');
  });

  it('enables high contrast diff when preview panel is selected', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const hcRadios = screen.getAllByRole('radio', { name: /High Contrast/ });
    const previewHcRadio = hcRadios[1];
    if (!previewHcRadio) throw new Error('High Contrast preview radio not found');
    fireEvent.click(previewHcRadio);
    expect(useThemeStore.getState().useHighContrastDiff).toBe(true);
  });

  it('disables high contrast diff when Regular is selected', () => {
    act(() => {
      useThemeStore.setState({ useHighContrastDiff: true });
    });
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByLabelText(/Regular/));
    expect(useThemeStore.getState().useHighContrastDiff).toBe(false);
  });

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    await user.keyboard('{Escape}');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies correct diff class based on theme and scheme', () => {
    act(() => {
      useThemeStore.setState({
        theme: 'dark',
        diffColorScheme: 'github',
        useHighContrastDiff: false,
      });
    });
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const previewPanels = document.querySelectorAll('.preview-panel');
    expect(previewPanels.length).toBeGreaterThan(0);
    const regularPanel = Array.from(previewPanels).find((p) =>
      p.className.includes('diff-github-dark')
    );
    expect(regularPanel).toBeInTheDocument();
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
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const previewPanels = document.querySelectorAll('.preview-panel');
    const regularPanel = Array.from(previewPanels).find((p) =>
      p.className.includes('diff-github-dark')
    );
    expect(regularPanel).toBeInTheDocument();
  });

  it('marks selected preview panel', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    const selectedPanels = document.querySelectorAll('.preview-panel-selected');
    expect(selectedPanels).toHaveLength(1);
  });

  it('allows changing through all UI themes', () => {
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
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
    render(<ThemeModal isOpen={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByLabelText(/GitHub Default/));
    expect(useThemeStore.getState().diffColorScheme).toBe('github');
    fireEvent.click(screen.getByLabelText(/Visual Studio/));
    expect(useThemeStore.getState().diffColorScheme).toBe('visual-studio');
    fireEvent.click(screen.getByLabelText(/CodeFlow Classic/));
    expect(useThemeStore.getState().diffColorScheme).toBe('codeflow-classic');
  });
});
