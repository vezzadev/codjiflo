import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { render, screen } from '@/tests/helpers';
import { BottomPane } from './BottomPane';

const tabs = [
  { id: 'comments', label: 'Comments', content: <div>Comments body</div> },
  { id: 'activity', label: 'Activity', content: <div>Activity body</div> },
];

describe('BottomPane', () => {
  it('renders the first tab as selected by default', () => {
    render(<BottomPane tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Comments', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity', selected: false })).toBeInTheDocument();
    expect(screen.getByText('Comments body')).toBeInTheDocument();
  });

  it('honors defaultTab', () => {
    render(<BottomPane tabs={tabs} defaultTab="activity" />);
    expect(screen.getByRole('tab', { name: 'Activity', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Activity body')).toBeInTheDocument();
  });

  it('moves between tabs with the keyboard', async () => {
    const user = userEvent.setup();
    render(<BottomPane tabs={tabs} />);
    const commentsTab = screen.getByRole('tab', { name: 'Comments' });
    commentsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Activity', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Activity body')).toBeInTheDocument();
  });

  it('exposes the pane as a region landmark named "Discussion"', () => {
    render(<BottomPane tabs={tabs} />);
    expect(screen.getByRole('region', { name: 'Discussion' })).toBeInTheDocument();
  });

  it('renders nothing when no tabs are provided', () => {
    const { container } = render(<BottomPane tabs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<BottomPane tabs={tabs} />);
    const results = await axe.run(container);
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });
});
