// EduNod 로컬 문서 내비게이션 구조 (외부 이탈 링크 제로 — 전 페이지 로컬 정적 빌드)
export const GITHUB = 'https://github.com/n8n-io/nod';

export const groups = [
  {
    label: '시작하기',
    items: [
      {
        slug: 'overview/',
        label: '에듀노드 소개 및 첫걸음',
        href: '/docs/',
        note: '교사의 컴퓨터에서 동작하는 AI 수업·행정 조교의 핵심 개념과 첫 활용법',
      },
      {
        slug: 'get-started/install-desktop/',
        label: '데스크톱 및 학급 서버 설치',
        href: '/docs/get-started/install-desktop/',
        note: 'macOS·Windows 설치부터 교무실 미니PC 24시간 상시 노드 구성까지',
      },
    ],
  },
  {
    label: '교육 환경 연결',
    items: [
      {
        slug: 'connect/apps/',
        label: 'LMS·알림장 및 학교 앱 연동',
        href: '/docs/connect/apps/',
        note: 'Google Classroom, Canvas, 학사 캘린더, 이메일·메신저 연동과 4단계 권한 제어',
      },
      {
        slug: 'connect/models/',
        label: 'AI 모델 및 로컬·교육청 서버',
        href: '/docs/connect/models/',
        note: '상용 모델, 학교 공용 게이트웨이, 폐쇄망 로컬 LLM 및 월간 예산 가드레일 설정',
      },
    ],
  },
  {
    label: '신뢰성 및 학생 데이터 보호',
    items: [
      {
        slug: 'trust/privacy/',
        label: '학생 개인정보 보호와 승인 원칙',
        href: '/docs/trust/privacy/',
        badge: '필독',
        note: '학생부·상담 기록 로컬 격리, 발송 전 교사 승인(Trust Check), 부담임·TA 역할 분리',
      },
      {
        slug: 'how-it-works/benchmarks/',
        label: '교육 현장 벤치마크 및 검증',
        href: '/docs/how-it-works/benchmarks/',
        badge: '리포트',
        note: '교무·수업 시나리오 완수율 98.2%, 무단 발송 0건, 장기 기억 및 인젝션 방어 측정 결과',
      },
    ],
  },
  {
    label: '실습 워크스페이스',
    items: [
      {
        slug: 'studio/',
        label: '에듀노드 스튜디오 열기 →',
        href: '/studio/',
        badge: '체험',
        note: '브라우저에서 수업 브리핑·승인 대기함·학급 기억장을 직접 다뤄보는 라이브 환경',
      },
    ],
  },
];

export function link(slug) {
  for (const g of groups) {
    const found = g.items.find((i) => i.slug === slug);
    if (found) return found;
  }
  return { slug, label: slug, href: '/docs/', note: '' };
}

export const editUrl = (path) => `${GITHUB}/tree/main/docs/${path}`;
