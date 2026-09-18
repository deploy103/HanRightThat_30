import { useRef } from 'react';
import type { PlayTab } from '../hooks/useRoute';

export type TabId = PlayTab;

export interface TabDef {
  id: TabId;
  title: string;
  sub: string;
}

export const TABS: TabDef[] = [
  { id: 'ranking', title: '순위', sub: '부스 모금' },
  { id: 'map', title: '지도', sub: '부스 위치' },
  { id: 'schedule', title: '공연', sub: '무대 순서' },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function FestivalTabs({ active, onChange }: Props) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
    const next = TABS[(index + step) % TABS.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <nav className="tabs">
      <div className="wrap tabs-inner" role="tablist" aria-label="축제 정보">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            className="tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={onKeyDown}
          >
            {tab.title}
            <small>{tab.sub}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}
