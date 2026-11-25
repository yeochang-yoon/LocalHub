# LocalHub

부산의 관광지와 문화시설을 지도에서 탐색하고, 장소에 후기를 남기거나 여행 일정을 만들 수 있는 웹 앱입니다. SSAFY에서 AI 개발 도구 활용을 배우며 3인 팀으로 진행한 제 첫 프론트엔드 프로젝트입니다.

Vue 3, Vite, Vue Router로 구성한 정적 SPA입니다. 부산 관광 데이터는 브라우저에서 `sql.js`로 조회하고, 게시글·대화 기록·여행 일정은 `localStorage`에 저장합니다.

[배포 데모](https://localhubkyh.netlify.app/)

## 주요 기능

| 화면 | 경로 | 구현 내용 |
| --- | --- | --- |
| 홈 | `/` | 지역·장소 검색, 여행 목적별 추천, 축제·공연과 최근 게시글 |
| 익명 게시판 | `/board` | 목록·상세·작성·수정·삭제, 비밀번호 확인, 검색·정렬·페이지네이션, 조회수·좋아요·북마크, 장소 및 사진 첨부 |
| 권역 정보 | `/regions` | 카테고리 선택과 검색, Leaflet·OpenStreetMap 지도 탐색, 장소 상세와 관련 게시글, Google Places 상세 정보 연동 |
| 대시보드 | `/dashboard` | 부산 관광 데이터의 구·군별 및 유형별 집계, 필터와 지도 분포 |
| 축제·날씨 캘린더 | `/calendar` | 월별 축제·공연 정보와 상세 링크, Open-Meteo 일별 예보·과거 날씨 |
| 여행 추천 | `/trip-planner` | 날짜·여행 목적·이동수단·필수 방문 장소를 반영한 일정 생성, 장소 추가·삭제·교체·순서 변경, 일정 저장과 경로 표시 |
| AI 챗봇 | 모든 화면 우측 하단 | 지역 데이터·게시글 검색을 바탕으로 OpenAI Responses API 답변 생성, 장소·게시글 상세 링크와 대화 기록 제공 |

## 담당 기능

### 익명 게시판

- Vue로 게시글 목록·상세·작성·수정 화면을 구성하고, `localStorage` 기반 CRUD와 수정·삭제 시 비밀번호 확인을 구현했습니다. 이전 버전의 게시글도 읽을 수 있도록 누락된 필드를 조회할 때 보정했습니다. [게시글 저장 로직](src/features/board/services/boardStorage.js) · [호환성 테스트](src/features/board/tests/boardCompatibility.test.mjs)
- 제목·작성자 검색, 카테고리 필터, 정렬, 페이지네이션, 조회수·좋아요·북마크를 구현했습니다. [게시판 목록](src/features/board/views/BoardListView.vue)
- 공용 SQLite에서 장소를 검색해 게시글에 첨부하고, `contentId`로 장소 상세와 연결했습니다. [장소 검색](src/features/board/services/boardPlaces.js)
- Canvas로 사진의 긴 변을 최대 1,600px로 줄이고 JPEG Data URL로 변환해 게시글과 함께 저장했습니다. [이미지 첨부](src/features/board/components/BoardImageUploader.vue)

### 축제·날씨 캘린더

- 월별 축제·공연을 보여주는 캘린더에 Open-Meteo를 연동해 날짜별 날씨, 최저·최고기온, 강수확률 또는 강수량을 표시했습니다. [캘린더 화면](src/features/calendar/views/CalendarView.vue)
- 예보와 과거 날씨 API 응답을 화면에서 함께 사용할 수 있는 일별 형식으로 변환했습니다. 지난 달로 이동하면 최근 2년 범위 안에서 해당 월의 과거 날씨를 조회합니다. [날씨 API](src/features/calendar/services/api/weatherApi.js) · [날씨 변환 테스트](src/features/calendar/tests/weatherApi.test.mjs)

## 로컬 실행

Node.js 22.12 이상에서 다음 명령으로 실행합니다. 터미널에 표시된 로컬 주소를 브라우저에서 엽니다.

```sh
npm ci
npm run dev
```

API 키 없이 게시판, 권역 탐색, 대시보드, 캘린더, 기본 여행 일정 생성을 사용할 수 있습니다. 지도 타일과 날씨 조회에는 인터넷 연결이 필요합니다. OpenAI·Google 기능을 로컬에서 확인하려면 [`.env.example`](.env.example)을 `.env`로 복사하고 필요한 값만 채웁니다.

| 환경 변수 | 용도 |
| --- | --- |
| `VITE_OPENAI_API_KEY` | 챗봇의 OpenAI Responses API 호출 |
| `VITE_OPENAI_MODEL` | 챗봇 모델 선택. 기본값은 `gpt-5-mini` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Places 상세 정보와 Google Directions 실제 이동 경로 |

`VITE_` 환경 변수는 브라우저 번들에 포함됩니다. OpenAI 운영 키는 서버나 서버리스 함수에서 관리해야 합니다. 현재 게시글과 수정용 비밀번호는 작성한 브라우저에 일반 텍스트로 저장되며, 사용자나 기기 간 동기화 기능은 없습니다.

## 프로젝트 구조

```text
LocalHub/
├── data/                    부산 TourAPI JSON, 출처, 스키마
├── scripts/                 챗봇 검색·파싱 테스트와 API 스모크 테스트
├── src/
│   ├── components/layout/   공통 헤더
│   ├── features/
│   │   ├── board/            익명 게시판
│   │   ├── calendar/         축제 데이터와 날씨 조회
│   │   ├── chatbot/          챗봇과 공용 SQLite 초기화
│   │   ├── dashboard/        관광 데이터 집계
│   │   ├── regions/          권역 지도와 장소 상세
│   │   └── trip/             일정 생성과 경로 조회
│   ├── router/              화면 경로
│   ├── styles/              공통 스타일
│   └── views/               홈 화면
└── netlify.toml             빌드 및 SPA 경로 설정
```

앱 시작 시 [`main.js`](src/main.js)가 [`chatbotDatabase.js`](src/features/chatbot/services/chatbotDatabase.js)를 호출해 TourAPI JSON 7종을 브라우저의 인메모리 SQLite에 적재합니다. 지도·게시판 장소 검색·대시보드·캘린더·여행 추천·챗봇이 같은 장소 데이터를 조회합니다. 게시글과 여행 일정은 브라우저를 새로 열어도 남도록 SQLite와 별도로 저장합니다.

이 저장소에 포함된 JSON의 `items`는 총 **1,758개**입니다. 음식점 원본 JSON은 현재 저장소에 포함되어 있지 않습니다. 축제 JSON에 개최 시작일·종료일이 없어 캘린더는 데이터의 수정일을 기준으로 표시합니다. [데이터 출처와 이용 조건](data/SOURCE.md) · [JSON 스키마](data/SCHEMA.md)

## 챗봇과 여행 추천 구현

- **챗봇** — 질문의 키워드·구·군·장소 유형을 분석해 장소와 관련 게시글을 검색하고, 검색 결과와 데이터의 한계를 OpenAI에 전달합니다. [질문 분석](src/features/chatbot/services/queryPlanner.js) · [검색 및 OpenAI 호출](src/features/chatbot/services/openai.js)
- **여행 추천** — 장소 간 거리와 방문 시간으로 일정을 계산하고, 실제 경로를 가져올 수 있는 구간에 Google Directions의 이동 시간과 경로를 반영합니다. [일정 생성](src/features/trip/services/scheduleGenerator.js) · [경로 반영](src/features/trip/views/TripPlannerView.vue)

## 테스트와 빌드

다음 명령은 API 키 없이 실행됩니다.

```sh
node --test "src/**/tests/*.test.mjs"
npm run test:openai-parser
npm run test:chat-query
npm run test:board-chat
npm run build
```

`npm run test:openai`는 실제 OpenAI API를 호출하는 테스트로 키가 필요합니다. Netlify는 `npm run build` 결과인 `dist/`를 배포하며, 새로고침이나 직접 접근 시에도 Vue Router가 경로를 처리하도록 [SPA 리다이렉트](netlify.toml)를 적용합니다.
