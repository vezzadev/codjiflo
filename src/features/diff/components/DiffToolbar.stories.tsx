import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffToolbar } from "./DiffToolbar";
import { useDiffStore } from "../stores";

// Base configuration shared across stories
const baseViewConfig = {
  mode: 'inline' as const,
  filter: 'both' as const,
  showFullFile: false,
  showWhitespace: false,
  showComments: true,
};

const baseState = {
  viewConfig: baseViewConfig,
  currentChangeIndex: 0,
  totalChangeCount: 5,
};

const meta = {
  title: "Features/Diff/DiffToolbar",
  component: DiffToolbar,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ padding: "20px", background: "var(--main-bg)" }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    // Reset store to default state before each story
    useDiffStore.setState(baseState);
  },
} satisfies Meta<typeof DiffToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default toolbar with inline view mode and "both" filter selected.
 */
export const Default: Story = {};

/**
 * Toolbar with split view mode.
 */
export const SplitView: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, mode: 'split' },
    });
  },
};

/**
 * Content filter in "left only" position.
 * Demonstrates the filter thumb at the left position showing deletions only.
 */
export const FilterLeftOnly: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, filter: 'left' },
    });
  },
};

/**
 * Content filter in "both" position.
 * Demonstrates the filter thumb in the center showing both additions and deletions.
 */
export const FilterBoth: Story = {};

/**
 * Content filter in "right only" position.
 * Demonstrates the filter thumb at the right position showing additions only.
 */
export const FilterRightOnly: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, filter: 'right' },
    });
  },
};

/**
 * Toolbar with full file view enabled.
 */
export const FullFileView: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, showFullFile: true },
    });
  },
};

/**
 * Toolbar with whitespace visible.
 */
export const WhitespaceVisible: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, showWhitespace: true },
    });
  },
};

/**
 * Toolbar with comments hidden.
 */
export const CommentsHidden: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      viewConfig: { ...baseViewConfig, showComments: false },
    });
  },
};

/**
 * Toolbar with navigation at last change.
 */
export const NavigationAtEnd: Story = {
  play: () => {
    useDiffStore.setState({
      ...baseState,
      currentChangeIndex: 4,
    });
  },
};
