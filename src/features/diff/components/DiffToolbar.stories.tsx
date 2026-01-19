import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffToolbar } from "./DiffToolbar";
import { useDiffStore } from "../stores";
import { useEffect } from "react";

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
} satisfies Meta<typeof DiffToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default toolbar with inline view mode and "both" filter selected.
 */
export const Default: Story = {
  render: () => {
    // Reset store to default state
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Toolbar with split view mode.
 */
export const SplitView: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'split',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Content filter in "left only" position.
 * Demonstrates the filter thumb at the left position showing deletions only.
 */
export const FilterLeftOnly: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'left',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Content filter in "both" position.
 * Demonstrates the filter thumb in the center showing both additions and deletions.
 */
export const FilterBoth: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Content filter in "right only" position.
 * Demonstrates the filter thumb at the right position showing additions only.
 */
export const FilterRightOnly: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'right',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Toolbar with full file view enabled.
 */
export const FullFileView: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: true,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Toolbar with whitespace visible.
 */
export const WhitespaceVisible: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: true,
          showComments: true,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Toolbar with comments hidden.
 */
export const CommentsHidden: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: false,
        },
        currentChangeIndex: 0,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};

/**
 * Toolbar with navigation at last change.
 */
export const NavigationAtEnd: Story = {
  render: () => {
    useEffect(() => {
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
        currentChangeIndex: 4,
        totalChangeCount: 5,
      });
    }, []);

    return <DiffToolbar />;
  },
};
