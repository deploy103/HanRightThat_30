import { describe, expect, it } from 'vitest';
import { HttpError, normalizeFestivalData, parseBoothInput, parseShowInput } from './validate.js';

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
      isActive: true,
      isPublic: true,
    });
  });

  it('모금액 0원을 허용한다', () => {
    expect(
      parseBoothInput({ name: 'a', team: 'b', floor: 3, amount: 0, position: { x: 0, y: 0 } })
        .amount,
    ).toBe(0);
  });

  it('잘못된 층은 거부한다', () => {
    expect(() =>
      parseBoothInput({ name: 'a', team: 'b', floor: 4, amount: 0, position: { x: 0, y: 0 } }),
    ).toThrow(HttpError);
  });

  it('위치는 0~100 범위로 잘라낸다', () => {
    const input = parseBoothInput({
      name: 'a',
      team: 'b',
      floor: 2,
      amount: 0,
      position: { x: -30, y: 180 },
    });
    expect(input.position).toEqual({ x: 0, y: 100 });
  });
});

describe('parseShowInput', () => {
  it('HH:MM 형식이 아니면 거부한다', () => {
    expect(() => parseShowInput({ time: '1300', team: 'a', title: 'b' })).toThrow(HttpError);
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
    expect(data.booths).toHaveLength(1);
    expect(data.shows.map((show) => [show.id, show.order])).toEqual([
      ['s1', 1],
      ['s2', 2],
    ]);
  });
});
