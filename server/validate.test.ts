import { describe, expect, it } from 'vitest';
import {
  HttpError,
  normalizeFestivalData,
  normalizeLandingState,
  parseBoothInput,
  parseLandingContent,
  parseMetaInput,
  parseShowInput,
} from './validate.js';
import { createSeedLandingContent } from './seed.js';

describe('parseBoothInput', () => {
  it('정상 입력을 정규화한다', () => {
    const input = parseBoothInput({
      name: '  솜사탕 부스 ',
      team: '2학년 3반',
      floor: '2',
      amount: '184,000',
      position: { x: '61.5', y: 21 },
    });
    expect(input).toEqual({
      name: '솜사탕 부스',
      team: '2학년 3반',
      floor: 2,
      amount: 184000,
      place: undefined,
      position: { x: 61.5, y: 21 },
      size: { w: 14, h: 10 },
      isActive: true,
      isPublic: true,
      summary: '',
      description: '',
      imagePath: '',
      imageAlt: '',
    });
  });

  it('이미지 경로 형식이 아니면 거부한다', () => {
    expect(() =>
      parseBoothInput({
        name: 'a',
        team: 'b',
        floor: 2,
        amount: 0,
        position: { x: 0, y: 0 },
        imagePath: 'https://evil.example/x.png',
      }),
    ).toThrow(HttpError);
    expect(() =>
      parseBoothInput({
        name: 'a',
        team: 'b',
        floor: 2,
        amount: 0,
        position: { x: 0, y: 0 },
        imagePath: '/booth-images/../../etc/passwd.png',
      }),
    ).toThrow(HttpError);
  });

  it('이미지 경로가 있으면 대체 텍스트를 요구한다', () => {
    expect(() =>
      parseBoothInput({
        name: 'a',
        team: 'b',
        floor: 2,
        amount: 0,
        position: { x: 0, y: 0 },
        imagePath: '/booth-images/placeholder.svg',
      }),
    ).toThrow(HttpError);

    const input = parseBoothInput({
      name: 'a',
      team: 'b',
      floor: 2,
      amount: 0,
      position: { x: 0, y: 0 },
      imagePath: '/booth-images/placeholder.svg',
      imageAlt: '기본 이미지',
    });
    expect(input.imagePath).toBe('/booth-images/placeholder.svg');
  });

  it('모금액 0원을 허용한다', () => {
    expect(
      parseBoothInput({ name: 'a', team: 'b', floor: 3, amount: 0, position: { x: 0, y: 0 } })
        .amount,
    ).toBe(0);
  });

  it('4층 부스를 허용한다', () => {
    expect(
      parseBoothInput({ name: 'a', team: 'b', floor: 4, amount: 0, position: { x: 0, y: 0 } }).floor,
    ).toBe(4);
  });

  it('1층 부스를 허용한다', () => {
    expect(
      parseBoothInput({ name: 'a', team: 'b', floor: 1, amount: 0, position: { x: 0, y: 0 } }).floor,
    ).toBe(1);
  });

  it('없는 층은 거부한다', () => {
    expect(() =>
      parseBoothInput({ name: 'a', team: 'b', floor: 5, amount: 0, position: { x: 0, y: 0 } }),
    ).toThrow(HttpError);
    expect(() =>
      parseBoothInput({ name: 'a', team: 'b', floor: 0, amount: 0, position: { x: 0, y: 0 } }),
    ).toThrow(HttpError);
  });

  it('부스 영역이 배치도 밖으로 나가지 않도록 중심 좌표를 안쪽으로 민다', () => {
    const input = parseBoothInput({
      name: 'a',
      team: 'b',
      floor: 2,
      amount: 0,
      position: { x: -30, y: 180 },
    });
    // 기본 크기 14x10 의 절반만큼 안쪽(7, 95)까지만 갈 수 있다.
    expect(input.position).toEqual({ x: 7, y: 95 });
  });

  it('크기를 지정하면 최소 크기 이상으로 저장하고, 너무 작은 값은 올려 준다', () => {
    const base = { name: 'a', team: 'b', floor: 2, amount: 0, position: { x: 50, y: 50 } };
    expect(parseBoothInput({ ...base, size: { w: 22, h: 16 } }).size).toEqual({ w: 22, h: 16 });
    expect(parseBoothInput({ ...base, size: { w: 1, h: 0 } }).size).toEqual({ w: 4, h: 4 });
  });

  it('size 가 없는 기존 데이터는 기본 크기로 채운다', () => {
    const input = parseBoothInput({ name: 'a', team: 'b', floor: 2, amount: 0, position: { x: 50, y: 50 } });
    expect(input.size).toEqual({ w: 14, h: 10 });
  });
});

describe('부스 모금액', () => {
  const base = { name: 'a', team: 'b', floor: 2, position: { x: 50, y: 50 } };

  it('시작 준비금 때문에 음수를 허용한다', () => {
    expect(parseBoothInput({ ...base, amount: -100000 }).amount).toBe(-100000);
    expect(parseBoothInput({ ...base, amount: '-50,000' }).amount).toBe(-50000);
  });

  it('목표 금액은 여전히 음수를 거부한다', () => {
    expect(() => parseMetaInput({ updated: '', goal: -1, stage: '' })).toThrow(HttpError);
  });
});

describe('parseShowInput', () => {
  it('HH:MM 형식이 아니면 거부한다', () => {
    expect(() => parseShowInput({ time: '1300', team: 'a', title: 'b' })).toThrow(HttpError);
  });

  it('곡명은 선택 입력이며 여러 곡을 받는다', () => {
    const base = { time: '14:20', team: '2-1', title: '밴드 공연' };
    expect(parseShowInput({ ...base, songTitles: [' 나는 반딧불 ', '', '사건의 지평선'] }).songTitles).toEqual([
      '나는 반딧불',
      '사건의 지평선',
    ]);
    expect(parseShowInput({ ...base, songTitles: ['', '  '] }).songTitles).toBeUndefined();
    expect(parseShowInput({ ...base, songTitles: [] }).songTitles).toBeUndefined();
    expect(parseShowInput(base).songTitles).toBeUndefined();
    expect(() => parseShowInput({ ...base, songTitles: Array.from({ length: 11 }, (_, i) => `곡${i}`) })).toThrow(HttpError);
  });

  it('이전 형식의 단일 songTitle 도 목록으로 받는다', () => {
    expect(parseShowInput({ time: '14:20', team: '2-1', title: '밴드 공연', songTitle: '나는 반딧불' }).songTitles).toEqual([
      '나는 반딧불',
    ]);
  });

  it('곡명이 없거나 단일 곡명으로 저장된 기존 데이터도 그대로 불러온다', () => {
    const data = normalizeFestivalData({
      meta: {},
      booths: [],
      shows: [
        { id: 'legacy', order: 1, time: '13:10', team: '3-2', title: '댄스', genre: '댄스' },
        { id: 'single', order: 2, time: '13:40', team: '밴드부', title: '밴드', songTitle: '나는 반딧불' },
      ],
    });
    expect(data.shows).toHaveLength(2);
    expect(data.shows[0].songTitles).toBeUndefined();
    expect(data.shows[1].songTitles).toEqual(['나는 반딧불']);
    expect(data.shows[1]).not.toHaveProperty('songTitle');
  });
});

describe('parseLandingContent', () => {
  const base = createSeedLandingContent();

  it('시드 기본값을 그대로 통과시킨다', () => {
    expect(parseLandingContent(base)).toEqual(base);
  });

  it('종료 시각이 시작 시각보다 이르면 거부한다', () => {
    expect(() =>
      parseLandingContent({
        ...base,
        startsAt: '2026-10-10T13:00:00+09:00',
        endsAt: '2026-10-10T09:00:00+09:00',
      }),
    ).toThrow(HttpError);
  });

  it('시간대 오프셋이 없는 날짜는 거부한다', () => {
    expect(() => parseLandingContent({ ...base, startsAt: '2026-10-10T13:00:00' })).toThrow(HttpError);
  });

  it('날짜가 미정(null)이어도 게시를 막지 않는다', () => {
    const content = parseLandingContent({ ...base, startsAt: null, endsAt: null });
    expect(content.startsAt).toBeNull();
    expect(content.endsAt).toBeNull();
  });

  it('https가 아닌 지도 링크는 거부한다', () => {
    expect(() => parseLandingContent({ ...base, directionsUrl: 'http://maps.example.com' })).toThrow(HttpError);
  });

  it('행사명이 비어 있으면 거부한다', () => {
    expect(() => parseLandingContent({ ...base, festivalName: '' })).toThrow(HttpError);
  });

  it('FAQ는 최대 20개까지만 허용한다', () => {
    const faqItems = Array.from({ length: 21 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` }));
    expect(() => parseLandingContent({ ...base, faqItems })).toThrow(HttpError);
  });

  it('FAQ 항목은 id가 없으면 자동으로 생성한다', () => {
    const content = parseLandingContent({ ...base, faqItems: [{ question: 'Q', answer: 'A' }] });
    expect(content.faqItems[0].id).toBeTruthy();
  });
});

describe('normalizeLandingState', () => {
  it('undefined를 넘기면 시드 상태를 반환한다', () => {
    expect(normalizeLandingState(undefined).draft.theme).toBe('소리');
  });

  it('landing 필드가 없는 예전 파일도 안전한 기본값으로 보완한다', () => {
    const data = normalizeFestivalData({ meta: {}, booths: [], shows: [] });
    expect(data.landing.revision).toBe(0);
    expect(data.landing.published).toBeNull();
    expect(data.landing.draft.theme).toBe('소리');
  });

  it('같은 보완을 다시 실행해도 draft가 중복되지 않는다', () => {
    const once = normalizeFestivalData({ meta: {}, booths: [], shows: [] });
    const twice = normalizeFestivalData(once);
    expect(twice.landing).toEqual(once.landing);
  });

  it('깨진 published는 버리고 draft는 보존한다', () => {
    const data = normalizeFestivalData({
      meta: {},
      booths: [],
      shows: [],
      landing: { revision: 3, draft: createSeedLandingContent(), published: { broken: true }, publishedAt: '오늘' },
    });
    expect(data.landing.published).toBeNull();
    expect(data.landing.publishedAt).toBeNull();
    expect(data.landing.revision).toBe(3);
  });
});

describe('normalizeFestivalData', () => {
  it('깨진 항목은 버리고 공연 순서를 1부터 다시 매긴다', () => {
    const data = normalizeFestivalData({
      meta: { updated: '기준', goal: 0, stage: '대강당' },
      booths: [{ id: 'x', name: 'a', team: 'b', floor: 2, amount: 10, position: { x: 1, y: 2 } }, {}],
      shows: [
        { id: 's2', order: 9, time: '14:00', team: 'a', title: 'b' },
        { id: 's1', order: 3, time: '13:00', team: 'c', title: 'd' },
      ],
    });
    // 깨진 부스 1개는 버려지고, 마이그레이션이 더하는 학부모 부스가 함께 들어온다.
    expect(data.booths.map((booth) => booth.id)).toEqual(['x', 'booth-parents']);
    expect(data.shows.map((show) => [show.id, show.order])).toEqual([
      ['s1', 1],
      ['s2', 2],
    ]);
  });
});
