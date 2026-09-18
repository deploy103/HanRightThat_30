import { useEffect, useMemo, useRef, useState } from 'react';
import type { Booth, FloorId } from '../../shared/types';
import { PanelHeading } from '../components/PanelHeading';
import { FLOOR_IDS, FLOOR_PLANS } from '../data/floorPlans';
import { formatWon } from '../lib/format';
import { BoothList } from './BoothList';
import { FloorPlan } from './FloorPlan';
import { FloorSelector } from './FloorSelector';

interface Props {
  booths: Booth[];
  /** /play/map?booth=<id> 로 들어왔을 때 한 번만 적용할 딥링크 대상. */
  initialBoothId?: string;
}

export function MapView({ booths, initialBoothId }: Props) {
  const [floor, setFloor] = useState<FloorId>(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deepLinkNotFound, setDeepLinkNotFound] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const appliedDeepLink = useRef(false);

  // 딥링크는 데이터가 처음 로딩된 시점에 한 번만 적용한다 — 8초 주기 재조회로 사용자가
  // 직접 고른 선택을 되돌리면 안 된다. 대상이 없으면(비공개/삭제/오타) 안내만 하고 지도는 그대로 쓴다.
  useEffect(() => {
    if (!initialBoothId || appliedDeepLink.current || booths.length === 0) return;
    const target = booths.find((booth) => booth.id === initialBoothId);
    appliedDeepLink.current = true;
    if (target) {
      setFloor(target.floor);
      setSelectedId(target.id);
      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setDeepLinkNotFound(true);
    }
  }, [initialBoothId, booths]);

  const counts = useMemo(
    () =>
      FLOOR_IDS.reduce(
        (acc, id) => {
          acc[id] = booths.filter((booth) => booth.floor === id).length;
          return acc;
        },
        { 2: 0, 3: 0 } as Record<FloorId, number>,
      ),
    [booths],
  );

  const floorBooths = useMemo(
    () => booths.filter((booth) => booth.floor === floor),
    [booths, floor],
  );
  const selected = booths.find((booth) => booth.id === selectedId) ?? null;

  /** 목록에서 고르면 해당 층으로 전환하고 지도로 포커스를 옮긴다. */
  const selectFromList = (booth: Booth) => {
    setFloor(booth.floor);
    setSelectedId(booth.id);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const changeFloor = (next: FloorId) => {
    setFloor(next);
    // 다른 층으로 바꾸면 선택 표시가 남지 않도록 정리한다.
    if (selected && selected.floor !== next) setSelectedId(null);
  };

  return (
    <>
      <PanelHeading
        title="부스"
        accent="지도"
        note="핀이나 목록을 누르면 위치를 표시합니다"
      />

      {deepLinkNotFound ? (
        <p className="empty empty-error" role="alert">
          부스를 찾을 수 없습니다. 아래 전체 지도에서 위치를 확인해 주세요.
        </p>
      ) : null}

      {booths.length === 0 ? (
        <p className="empty">등록된 부스가 없습니다. 관리 화면에서 부스를 추가해 주세요.</p>
      ) : (
        <div className="map-layout">
          <div className="map-panel" ref={mapRef}>
            <FloorSelector active={floor} onChange={changeFloor} counts={counts} />
            <FloorPlan
              floor={floor}
              booths={floorBooths}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <div className="map-status" aria-live="polite">
              {selected ? (
                <>
                  <span className="map-status-name">{selected.name}</span>
                  <span className="map-status-meta">
                    {selected.team} · {selected.place ?? `${selected.floor}층`}
                  </span>
                  <span className="map-status-amount">{formatWon(selected.amount)}원</span>
                </>
              ) : (
                <span className="map-status-meta">
                  {FLOOR_PLANS[floor].label} 부스 {counts[floor]}개 · 핀을 선택해 보세요
                </span>
              )}
            </div>
          </div>

          <BoothList booths={booths} selectedId={selectedId} onSelect={selectFromList} />
        </div>
      )}
    </>
  );
}
