'use client';

import { ReactNode } from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';

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
 * Bottom pane with tabbed content (Comments, Activity, Search Results)
 */
export function BottomPane({ tabs, defaultTab, height }: BottomPaneProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="bottom-pane" id="bottomPane" style={height ? { height } : undefined}>
      <Tabs defaultSelectedKey={defaultTab ?? tabs[0]?.id ?? ''} className="tabs">
        <TabList className="tab-list">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              className={({ isSelected }) => `tab-item ${isSelected ? 'active' : ''}`}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>
        {tabs.map((tab) => (
          <TabPanel key={tab.id} id={tab.id} className="tab-content">
            {tab.content}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
