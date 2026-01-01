'use client';

import { ReactNode, useState } from 'react';

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
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');

  if (tabs.length === 0) {
    return null;
  }

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="bottom-pane" id="bottomPane" style={height ? { height } : undefined}>
      <div className="tabs">
        <div className="tab-list" role="tablist">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(tab.id);
                }
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>
        <div className="tab-content">
          <div className="tab-panel active" role="tabpanel">
            {activeTabContent}
          </div>
        </div>
      </div>
    </div>
  );
}
