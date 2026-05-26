'use client';

import { ReactNode, useRef } from 'react';
import { Tabs, TabList, Tab, TabPanel, useLandmark } from '@/components/ui';

interface TabConfig {
  id: string;
  label: string;
  content: ReactNode;
}

interface BottomPaneProps {
  tabs: TabConfig[];
  defaultTab?: string;
  height?: number;
}

/**
 * Bottom pane with tabbed content (Comments, Activity, Search Results).
 * Registered as an ARIA "region" landmark via useLandmark so F6 cycles to it.
 */
export function BottomPane({ tabs, defaultTab, height }: BottomPaneProps) {
  const landmarkRef = useRef<HTMLDivElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'region', 'aria-label': 'Discussion' },
    landmarkRef,
  );

  if (tabs.length === 0) {
    return null;
  }

  const initialTab = defaultTab ?? tabs[0]?.id ?? '';

  return (
    <div
      {...landmarkProps}
      ref={landmarkRef}
      className="bottom-pane"
      id="bottomPane"
      style={height ? { height } : undefined}
    >
      <Tabs className="tabs" defaultSelectedKey={initialTab}>
        <TabList className="tab-list" aria-label="Discussion tabs">
          {tabs.map((tab) => (
            <Tab key={tab.id} id={tab.id} className="tab-item">
              {tab.label}
            </Tab>
          ))}
        </TabList>
        <div className="tab-content">
          {tabs.map((tab) => (
            <TabPanel key={tab.id} id={tab.id} className="tab-panel">
              {tab.content}
            </TabPanel>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
