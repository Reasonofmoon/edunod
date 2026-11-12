# 에듀노드 (EduNod)

**학원 원장 · 학원 강사 · 초중고 교사 · 대학 교수자를 위한 로컬 우선(Local-First) 오픈소스 AI 에이전트 워크스페이스**

에듀노드(EduNod)는 원생·학생 개인정보와 수납 원장을 로컬 환경에 안전하게 격리하면서, **실제 멀티스텝 도구 호출(Tool-Calling) AI 에이전트**와 **인간 최종 승인 게이트(Trust Check)**를 결합한 교육 기관 전용 AI 조교 웹 애플리케이션입니다.

## 주요 기능

- **4대 교육 현장 맞춤 모드 (`/studio/`)**
  - **학원 운영자(원장·실장) 모드**: 등·하원 미등원 안심 알림톡 초안, 수강료(원비) 미납 `D+5` 정중 안내, 신규 레벨테스트 입학 상담 브리핑, 성적·출결 저하 기반 휴·퇴원 위험군 조기 감지
  - **학원 강사(수업·오답 클리닉) 모드**: 반별 일일 수업·과제 피드백 알림톡 초안, 커트라인 미달 원생 맞춤 **오답 클리닉 변형 문항 및 강사용 해설 실시간 생성**, 인근 학교별 내신 시험범위 기억장
  - **초·중·고 담임·교과 모드**: 등교 전 수업·세특 상담 브리핑, 수행평가 미제출 독려, 수업 도입 5분 형성평가 생성
  - **대학·연구실 모드**: LMS 미답변 질의응답 강의계획서 기반 초안, 수업 조교(TA) 결재 상신 워크플로우
- **실제 AI 에이전트 런타임 결합 (`/api/agent/status`, `/api/agent/run`)**
  - Google Gemini (`gemini-2.5-flash`), Anthropic Claude (`claude-sonnet-4-20250514`), OpenAI/OpenRouter 및 폐쇄망 로컬 LLM(Ollama/vLLM) 자동 페일오버 지원
  - 서버 전용 API 키 처리로 클라이언트 번들 시크릿 노출 원천 차단
- **교육 보안 & 권한 분리 (Trust Check + RBAC)**
  - 모든 외부 알림톡·공지·청구 메시지는 즉시 발송되지 않고 **최종 승인 대기함(Trust Queue)**에 격리 등록
  - `강사 · 조교(TA)` 제한 권한 전환 시 **원장 전용 원비 수납·미납 금액과 민감 상담 메모 자동 마스킹**

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정 (.env 생성 후 GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 입력)
cp .env.example .env

# 3. 개발 서버 실행 (http://localhost:4321/ 및 /studio/)
npm run dev

# 4. 프로덕션 정적 빌드 + 무결성 검증 + 독립 에이전트 서버 실행
npm run build
npm run verify
npm start
```

## 프로젝트 구조

```text
├── astro.config.mjs            # Astro 설정 및 개발 서버 실시간 에이전트 미들웨어
├── server.mjs                  # 프로덕션 정적 파일 + /api/agent/* 통합 Node 서버
├── src/
│   ├── server/agent-runtime.mjs # 멀티 LLM 도구 호출(5종) + Trust Check + RBAC 런타임
│   ├── pages/
│   │   ├── index.astro         # 에듀노드 메인 랜딩 페이지
│   │   ├── studio/index.astro  # 실시간 AI 에이전트 인터랙티브 스튜디오
│   │   └── docs/               # 한국어 교육 도입 문서 가이드 (6개 섹션)
│   ├── components/             # 공통 UI · 통합 검색(Ctrl+K) · 테마 스위치
│   ├── layouts/                # 랜딩 및 문서 레이아웃
│   └── styles/                 # 라이트/다크 디자인 토큰 및 반응형 스타일
└── tools/verify.mjs            # 라우트·링크·앵커·랜드마크 무결성 자동 검증기
```

## 라이선스

Apache License 2.0
