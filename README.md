# 제30회 한빛제 안내 웹사이트

부스 모금 순위 · 부스 배치도(2층/3층) · 공연 순서를 보여주는 공개 화면과,
운영자가 데이터를 직접 관리하는 `/admin` 화면으로 구성된다.

## 스택

- 클라이언트: React 18 + TypeScript + Vite (스타일은 순수 CSS + CSS 변수 토큰)
- 서버: Express + TypeScript REST API
- 저장소: `data/festival.json` 파일 (원자적 쓰기, 재시작 후에도 유지)

## 실행

```bash
npm install

# 개발 (API 8787 + Vite 5173, /api 는 프록시)
npm run dev

# 운영 빌드 후 단일 포트(8787)로 서비스
npm run build
npm start
```

- 공개 화면: `http://localhost:8787/`
- 관리 화면: `http://localhost:8787/admin`

## 검증

```bash
npm run lint       # eslint
npm run typecheck  # tsc (클라이언트 + 서버)
npm test           # vitest
npm run build      # production build
```

## 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8787` | API/정적 파일 포트 |
| `FESTIVAL_DB` | `data/festival.json` | 데이터 파일 경로 |
| `ADMIN_KEY` | (없음) | 설정하면 모든 쓰기 요청에 `x-admin-key` 헤더를 요구한다. 관리 화면에 키 입력란이 나타난다. |

## 데이터 구조

`data/festival.json` 한 파일에 저장한다. 파일이 없으면 `server/seed.ts` 의 기본값(부스 8개, 공연 6개)으로 생성된다.

```jsonc
{
  "meta": { "updated": "9월 8일 오후 3시 기준", "goal": 0, "stage": "대강당" },
  "booths": [
    {
      "id": "booth-cottoncandy",
      "name": "솜사탕 부스",
      "team": "2학년 3반",
      "floor": 2,            // 2 | 3
      "amount": 184000,      // 운영자 수기 입력
      "place": "2층 클라우드보안과 1-1",
      "position": { "x": 61.5, "y": 33 }  // 층 배치도 기준 0~100%
    }
  ],
  "shows": [
    { "id": "show-opening", "order": 1, "time": "13:00", "team": "밴드부", "title": "오프닝 무대", "genre": "밴드" }
  ]
}
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/festival` | 전체 데이터 |
| GET | `/api/admin/status` | 관리자 키 필요 여부 |
| PUT | `/api/meta` | 갱신 문구 / 목표액 / 공연 장소 |
| POST | `/api/booths` | 부스 추가 |
| PUT | `/api/booths/:id` | 부스 수정 (금액 포함) |
| DELETE | `/api/booths/:id` | 부스 삭제 |
| POST | `/api/shows` | 공연 추가 |
| PUT | `/api/shows/:id` | 공연 수정 |
| PUT | `/api/shows/order` | 공연 순서 변경 (`{ ids: [...] }`) |
| DELETE | `/api/shows/:id` | 공연 삭제 |

## 화면 구성

- `src/festival/` 공개 화면 (RankingView / MapView / ScheduleView)
- `src/admin/` 운영자 화면 (AdminBooths / AdminShows / AdminMeta)
- `src/data/floorPlans.ts` 층 배치도 형상 데이터 (2층/3층이 같은 `FloorPlan` 컴포넌트를 공유)
- `src/styles/tokens.css` 색·폰트·레이아웃 토큰
