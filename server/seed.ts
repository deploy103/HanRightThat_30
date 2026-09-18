import type { FestivalData, LandingContent, LandingState } from '../shared/types.js';

/**
 * 소개 콘텐츠 초기 시드. published는 항상 null로 시작한다 —
 * 운영자가 초안을 검토하고 명시적으로 게시해야 공개된다 (요구사항2 §13).
 */
export function createSeedLandingContent(): LandingContent {
  return {
    // festivalName은 회차를 뺀 축제 이름만 담는다 — edition/year와 조합해
    // "2026 · 제30회 한빛제"처럼 화면에서 만들어 보여주므로 여기에 "제30회"를 또 넣으면 중복된다.
    festivalName: '한빛제',
    edition: 30,
    year: 2026,
    theme: '소리',
    heroTitle: '한빛제',
    heroDescription: '',
    startsAt: null,
    endsAt: null,
    venueName: '',
    address: '',
    directionsUrl: '',
    themeTitle: '',
    themeBody: '',
    audienceInfo: '',
    admissionInfo: '',
    paymentInfo: '',
    operatingHoursInfo: '',
    contactInfo: '',
    organizerText: '',
    creditsText: '',
    faqItems: [],
  };
}

export function createSeedLandingState(): LandingState {
  return {
    revision: 0,
    draft: createSeedLandingContent(),
    published: null,
    publishedAt: null,
  };
}

/**
 * 최초 실행 시 한 번만 기록되는 기본 데이터.
 * 이후에는 data/festival.json 이 단일 진실 공급원이며 관리자 화면에서 수정한다.
 * 여기 값은 "코드에 박힌 화면"이 아니라 DB 초기 시드일 뿐이다.
 */
export function createSeedData(): FestivalData {
  return {
    meta: {
      updated: '9월 8일 오후 3시 기준',
      goal: 0,
      stage: '대강당',
    },
    settings: {
      rankingsPublic: true,
    },
    booths: [
      {
        id: 'booth-cottoncandy',
        name: '솜사탕 부스',
        team: '2학년 3반',
        floor: 2,
        amount: 184000,
        place: '2층 클라우드보안과 1-1',
        position: { x: 61.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-escape',
        name: '방탈출 카페',
        team: '동아리 연합',
        floor: 2,
        amount: 151500,
        place: '2층 클라우드보안과 1-2',
        position: { x: 81.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-tarot',
        name: '타로 점집',
        team: '1학년 5반',
        floor: 2,
        amount: 97000,
        place: '2층 지능형소프트웨어과 1-1',
        position: { x: 19.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-slush',
        name: '슬러시 바',
        team: '3학년 1반',
        floor: 2,
        amount: 64200,
        place: '2층 메타버스게임과 1-1',
        position: { x: 40.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-photo',
        name: '사진관',
        team: '사진부',
        floor: 3,
        amount: 38500,
        place: '3층 클라우드보안과 2-2',
        position: { x: 81.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-boardgame',
        name: '보드게임 존',
        team: '2학년 1반',
        floor: 3,
        amount: 52300,
        place: '3층 클라우드보안과 2-1',
        position: { x: 61.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-goods',
        name: '굿즈 상점',
        team: '미술부',
        floor: 3,
        amount: 31000,
        place: '3층 메타버스게임과 2-1',
        position: { x: 40.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      {
        id: 'booth-tteok',
        name: '떡볶이 포차',
        team: '3학년 4반',
        floor: 3,
        amount: 88700,
        place: '3층 지능형소프트웨어과 2-1',
        position: { x: 19.5, y: 33 },
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
    ],
    shows: [
      {
        id: 'show-opening',
        order: 1,
        time: '13:00',
        team: '밴드부',
        title: '오프닝 무대',
        genre: '밴드',
        note: '개회 선언 직후',
      },
      {
        id: 'show-dance',
        order: 2,
        time: '13:30',
        team: '댄스동아리',
        title: '커버 댄스 메들리',
        genre: '댄스',
      },
      {
        id: 'show-vocal',
        order: 3,
        time: '14:00',
        team: '보컬팀',
        title: '어쿠스틱 세션',
        genre: '보컬',
      },
      {
        id: 'show-class',
        order: 4,
        time: '14:30',
        team: '2학년 4반',
        title: '학급 장기자랑',
        genre: '장기자랑',
      },
      {
        id: 'show-band2',
        order: 5,
        time: '15:00',
        team: '교사 밴드',
        title: '특별 무대',
        genre: '밴드',
      },
      {
        id: 'show-closing',
        order: 6,
        time: '15:40',
        team: '학생회',
        title: '모금 결과 발표 · 폐회',
        genre: '시상',
        note: '부스 모금 순위 발표',
      },
    ],
    scheduleItems: [
      { id: 'schedule-open', time: '12:30', title: '개회식', note: '운동장 집합' },
      { id: 'schedule-booth', time: '13:00', title: '부스 운영 시작' },
      { id: 'schedule-close', time: '16:00', title: '폐회식 · 모금 결과 발표' },
    ],
    announcements: [],
    landing: createSeedLandingState(),
  };
}
