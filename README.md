# LocalHub

부산 지역 정보, 커뮤니티 게시판, OpenAI 챗봇을 제공하는 Vue 3 SPA입니다.

## 시작하기

Node.js 20 이상을 설치한 뒤 실행합니다.

```bash
npm install
copy .env.example .env
npm run dev
```

OpenAI 기능을 테스트하려면 `.env`의 `VITE_OPENAI_API_KEY`를 설정합니다. `VITE_` 환경 변수는 브라우저 번들에 노출되므로 제출·배포용 키는 넣지 말고, 실제 서비스에서는 서버리스 함수나 백엔드 프록시를 사용하세요.

## 3인 협업 구조

각 담당자는 아래 폴더 안에서 독립적으로 개발합니다. 공용 레이아웃이나 라우터 변경이 필요할 때만 사전에 합의합니다.

| 담당 | 작업 영역 | 진입 경로 |
| --- | --- | --- |
| 게시판 | `src/features/board/` | `/board` |
| 권역정보 | `src/features/regions/` | `/regions` |
| OpenAI 챗봇 | `src/features/chatbot/` | 모든 화면의 우측 하단 버튼 |

- 공용 컴포넌트: `src/components/`
- 페이지 조합: `src/views/`
- 전역 스타일: `src/styles/`
- 라우팅: `src/router/index.js`

권장 브랜치는 `feature/board`, `feature/regions`, `feature/chatbot`입니다. 권역정보 원본은 루트의 `data/`에 있으며, 데이터 내용은 공공누리 제3유형 조건에 따라 수정하지 않습니다.
