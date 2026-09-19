import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Announcement, Booth } from '../../shared/types';
import { FloorPlan } from './FloorPlan';
import { NoticeView } from './NoticeView';

/**
 * 브라우저 없이 확인할 수 있는 최소 렌더 검증.
 * JSX 대신 createElement 를 쓰는 이유는 이 저장소의 테스트 include 패턴(*.test.ts)에 맞추기 위해서다.
 */

function booth(overrides: Partial<Booth> = {}): Booth {
  return {
    id: 'b1',
    name: '솜사탕 부스',
    team: '2학년 3반',
    floor: 2,
    amount: 1000,
    position: { x: 61.5, y: 33 },
    isActive: true,
    isPublic: true,
    archivedAt: null,
    ...overrides,
  };
}

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    title: '우천 시 안내',
    body: '비가 오면 체육관으로 이동합니다.',
    isPublished: true,
    createdAt: '2026-09-18T10:00:00+09:00',
    updatedAt: '2026-09-18T10:00:00+09:00',
    ...overrides,
  };
}

describe('공지 탭', () => {
  it('공지가 없으면 안내 문구를 보여 준다', () => {
    const html = renderToStaticMarkup(createElement(NoticeView, { announcements: [] }));
    expect(html).toContain('등록된 공지가 없습니다.');
  });

  it('제목·작성 날짜를 보여 주고 본문은 접어 둔다', () => {
    const html = renderToStaticMarkup(createElement(NoticeView, { announcements: [announcement()] }));
    expect(html).toContain('우천 시 안내');
    expect(html).toContain('2026년 9월 18일');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden=""');
  });

  it('최신순으로 정렬한다', () => {
    const html = renderToStaticMarkup(
      createElement(NoticeView, {
        announcements: [
          announcement({ id: 'old', title: '예전 공지', updatedAt: '2026-09-01T10:00:00+09:00' }),
          announcement({ id: 'new', title: '새 공지', updatedAt: '2026-09-18T10:00:00+09:00' }),
        ],
      }),
    );
    expect(html.indexOf('새 공지')).toBeLessThan(html.indexOf('예전 공지'));
  });

  it('본문의 HTML 을 실행 가능한 마크업으로 내보내지 않는다 (XSS 방지)', () => {
    const html = renderToStaticMarkup(
      createElement(NoticeView, {
        announcements: [announcement({ title: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script>' })],
      }),
    );
    // 태그 구분자가 이스케이프되어 있으면 브라우저는 이것을 마크업이 아니라 글자로 읽는다.
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('공개 층 배치도', () => {
  it('교실과 오른쪽 계단을 그리고 왼쪽 계단은 그리지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(FloorPlan, { floor: 2, booths: [], selectedId: null, onSelect: () => {} }),
    );
    expect(html).toContain('지능형소프트웨어과 1-1');
    expect(html).toContain('복도');
    // 계단은 오른쪽 하나뿐이다.
    expect(html.match(/계단/g)).toHaveLength(1);
    expect(html).toContain('left:91.5%');
  });

  it('부스를 중심 좌표 + 크기 기준의 사각형으로 그린다 (모두 % 단위)', () => {
    const html = renderToStaticMarkup(
      createElement(FloorPlan, {
        floor: 2,
        booths: [booth({ size: { w: 20, h: 10 } })],
        selectedId: null,
        onSelect: () => {},
      }),
    );
    // 중심 (61.5, 33), 크기 20x10 → 왼쪽 위 (51.5, 28)
    expect(html).toContain('left:51.5%');
    expect(html).toContain('top:28%');
    expect(html).toContain('width:20%');
    expect(html).toContain('height:10%');
    // 픽셀 좌표가 섞여 들어가면 모바일에서 위치가 어긋난다.
    expect(html).not.toMatch(/(left|top|width|height):\d+px/);
  });

  it('size 가 없는 기존 부스도 기본 크기로 그려진다', () => {
    const html = renderToStaticMarkup(
      createElement(FloorPlan, { floor: 2, booths: [booth()], selectedId: null, onSelect: () => {} }),
    );
    expect(html).toContain('width:14%');
    expect(html).toContain('height:10%');
  });

  it('선택/운영 종료 상태가 클래스에 반영된다', () => {
    const html = renderToStaticMarkup(
      createElement(FloorPlan, {
        floor: 3,
        booths: [booth({ id: 'sel', floor: 3 }), booth({ id: 'ended', floor: 3, isActive: false })],
        selectedId: 'sel',
        onSelect: () => {},
      }),
    );
    expect(html).toContain('booth-area is-selected');
    expect(html).toContain('is-ended');
  });
});
