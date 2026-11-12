// EduNod Real AI Agent Runtime (Server-Side Only — Keys Never Exposed to Client)
// Supports Google Gemini (Function Calling), Anthropic Claude (Tool Use), and OpenAI-Compatible / Local Ollama.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function parseEnvFile(filePath) {
  const out = {};
  try {
    if (!fs.existsSync(filePath)) return out;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
  } catch {
    // Ignore unreadable env files safely
  }
  return out;
}

export function loadCredentials(customHeaders = {}) {
  const homeEnv = parseEnvFile(path.join(os.homedir(), '.env'));
  const appEnv = parseEnvFile(path.resolve('.env'));
  const pick = (k) => process.env[k] || appEnv[k] || homeEnv[k] || '';

  const geminiKey = customHeaders.geminiKey || pick('GEMINI_API_KEY') || pick('GOOGLE_API_KEY');
  const anthropicKey = customHeaders.anthropicKey || pick('ANTHROPIC_API_KEY');
  const openaiKey = customHeaders.openaiKey || pick('OPENAI_API_KEY');
  const openrouterKey = customHeaders.openrouterKey || pick('OPENROUTER_API_KEY');
  const localUrl = customHeaders.localUrl || pick('OPENAI_COMPATIBLE_BASE_URL') || '';

  return {
    gemini: Boolean(geminiKey),
    anthropic: Boolean(anthropicKey),
    openai: Boolean(openaiKey),
    openrouter: Boolean(openrouterKey),
    local: Boolean(localUrl),
    _secrets: { geminiKey, anthropicKey, openaiKey, openrouterKey, localUrl },
  };
}

export function getPublicAgentStatus(customHeaders = {}) {
  const creds = loadCredentials(customHeaders);
  const defaultProvider = creds.gemini
    ? 'gemini'
    : creds.anthropic
      ? 'anthropic'
      : creds.openai
        ? 'openai'
        : creds.openrouter
          ? 'openrouter'
          : creds.local
            ? 'local'
            : 'none';

  return {
    live: defaultProvider !== 'none',
    defaultProvider,
    providers: {
      gemini: creds.gemini,
      anthropic: creds.anthropic,
      openai: creds.openai,
      openrouter: creds.openrouter,
      local: creds.local,
    },
  };
}

// Tool Schemas shared across Gemini, Claude, and OpenAI-compatible runtimes
const AGENT_TOOLS = [
  {
    name: 'query_workspace_records',
    description:
      '현재 교육 기관(학원 원장실, 학원 강사실, 초중고 학급, 대학 강의실)의 로컬 원생/학생 출결, 과제·테스트 점수, 수납/미납 현황(원장 권한 전용), 상담 메모, 기억장 원칙을 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'students', 'attendance', 'billing', 'scores', 'memories'],
          description: '조회할 데이터 영역',
        },
        filterKeyword: {
          type: 'string',
          description: '특정 반 이름, 학생/원생 이름 또는 상태 검색어 (선택)',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'create_briefing',
    description:
      '교사·교수·학원 원장·강사를 위한 구조화된 1페이지 브리핑 카드를 생성하여 [브리핑] 탭 상단에 즉시 추가합니다.',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: '브리핑 분류 배지 (예: 실시간 AI 분석 · 원장 수납/출결 브리핑)' },
        title: { type: 'string', description: '브리핑 제목' },
        summary: { type: 'string', description: '핵심 현황 요약 (2~4문장)' },
        sensitiveNote: {
          type: 'string',
          description: '원장/담임 전용 민감 메모(원비 미납 상세, 퇴원 위험 징후, 심층 상담 내용 등 — 없으면 빈 문자열)',
        },
        checklist: {
          type: 'array',
          items: { type: 'string' },
          description: '실행 점검 체크리스트 항목들 (2~4개)',
        },
      },
      required: ['tag', 'title', 'summary', 'checklist'],
    },
  },
  {
    name: 'propose_external_message',
    description:
      '학부모 알림톡/문자(등하원 결석 케어, 일일 수업 피드백 리포트, 수강료 미납/재등록 안내, 보강 안내) 또는 LMS/클래스룸 공지 초안을 작성하여 [승인 대기함(Trust Queue)]에 상신합니다. 절대 직접 발송하지 않고 승인 대기 카드를 생성합니다.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: '발송 채널명 (예: 학원 알림톡 · 비즈메모, 결제선생 청구 안내, Google Classroom, 하이클래스)',
        },
        recipientScope: {
          type: 'string',
          description: '수신 대상 및 인원수 (예: 개별 발송 · 박시우 학부모님, 중3 심화A반 학부모 전체 12명)',
        },
        title: { type: 'string', description: '승인 대기 카드 제목' },
        draftBody: { type: 'string', description: '정중하고 구체적인 실제 발송 문구 초안 전문' },
      },
      required: ['channel', 'recipientScope', 'title', 'draftBody'],
    },
  },
  {
    name: 'generate_clinic_worksheet',
    description:
      '학원 강사나 교사를 위해 오답 클리닉·보강 수업·형성평가용 맞춤 문항 세트와 채점 가이드를 생성하여 [클리닉·수업자료] 목록에 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        targetGroup: { type: 'string', description: '대상 반 또는 학생군 (예: 중3 수학 심화A반 이차함수 오답 클리닉)' },
        topic: { type: 'string', description: '단원 및 핵심 개념' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              q: { type: 'string', description: '문항 지문' },
              answerAndTip: { type: 'string', description: '정답 및 강사용 지도 핵심 포인트' },
            },
            required: ['q', 'answerAndTip'],
          },
          description: '맞춤 변형/확인 문항 목록 (2~4문항)',
        },
      },
      required: ['targetGroup', 'topic', 'questions'],
    },
  },
  {
    name: 'save_workspace_memory',
    description:
      '학원 운영 원칙, 강사 피드백 스타일, 학급 평가 기준, 원생/학생별 학습 특성을 [기억장(Memory Vault)]에 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['평가·수업 원칙', '학사·학원 일정', '상담·배려 메모', '수납·운영 원칙'],
          description: '기억 분류',
        },
        text: { type: 'string', description: '저장할 구체적인 기억 문장' },
        sensitive: { type: 'boolean', description: '원장/담임 전용 민감 정보 여부' },
      },
      required: ['category', 'text', 'sensitive'],
    },
  },
];

// Independent Server-Side Trust Check & RBAC Verifier
function executeWorkspaceTool(toolName, args, ctx) {
  const { role, workspace, effects } = ctx;
  const isRestrictedRole = role === 'ta'; // 부담임, 파트강사, 조교

  if (toolName === 'query_workspace_records') {
    const cat = args.category || 'all';
    const kw = (args.filterKeyword || '').trim().toLowerCase();
    const matchKw = (obj) => !kw || JSON.stringify(obj).toLowerCase().includes(kw);

    const students = (workspace.roster || []).filter(matchKw).map((s) => {
      if (isRestrictedRole) {
        const copy = { ...s };
        delete copy.tuitionStatus;
        delete copy.tuitionAmount;
        delete copy.churnRiskReason;
        if (copy.sensitiveMemo) copy.sensitiveMemo = '[원장/담임 전용 비공개]';
        return copy;
      }
      return s;
    });

    const billingAllowed = !isRestrictedRole;
    effects.audits.push(
      `[에이전트 로컬 조회] category=${cat}${kw ? `, 검색="${kw}"` : ''}${!billingAllowed && cat === 'billing' ? ' (강사/조교 권한: 수납 원장 비공개 마스킹)' : ''}`
    );

    return {
      role,
      billingAccessGranted: billingAllowed,
      students: cat === 'all' || cat === 'students' || cat === 'attendance' || cat === 'scores' || cat === 'billing' ? students : undefined,
      memories:
        cat === 'all' || cat === 'memories'
          ? (workspace.memories || [])
              .filter((m) => !(isRestrictedRole && m.sensitive))
              .filter(matchKw)
          : undefined,
      schedules: cat === 'all' ? workspace.schedules || [] : undefined,
      note:
        !billingAllowed && cat === 'billing'
          ? '현재 접속 역할(강사/조교)에서는 원비 미납 금액 상세 열람이 제한됩니다. 원장 권한에서만 상세 금액 조회가 가능합니다.'
          : '로컬 워크스페이스 조회 완료',
    };
  }

  if (toolName === 'create_briefing') {
    const card = {
      id: 'b_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      tag: args.tag || '실시간 AI 에이전트 브리핑',
      title: args.title,
      sensitive: Boolean(args.sensitiveNote),
      summary: args.summary,
      sensitiveNote: args.sensitiveNote || '',
      checks: (args.checklist || []).map((t) => ({ text: t, done: false })),
    };
    effects.briefings.push(card);
    effects.audits.push(`[AI 브리핑 생성] "${card.title}" 카드가 브리핑 탭에 추가됨`);
    return { status: 'CREATED', briefingTitle: card.title };
  }

  if (toolName === 'propose_external_message') {
    // TRUST CHECK GATE: Block raw resident registration numbers & force human approval queue
    const sanitizedDraft = String(args.draftBody || '').replace(/\b\d{6}-[1-4]\d{6}\b/g, '[주민번호 자동 마스킹]');
    const channelLabel = isRestrictedRole
      ? `${args.channel} (강사/조교 상신 → 원장/담임 결재 대기)`
      : args.channel;

    const approval = {
      id: 'ap_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      app: channelLabel,
      scope: args.recipientScope,
      title: args.title,
      draft: sanitizedDraft,
    };
    effects.approvals.push(approval);
    effects.audits.push(
      `[Trust Check 발송 차단 · 승인함 격리] ${args.channel} (${args.recipientScope}) — "${args.title}"`
    );
    return {
      status: 'QUEUED_IN_TRUST_CHECK',
      message:
        '외부 발송이 자동 차단되고 승인 대기함(Trust Queue)에 안전하게 등록되었습니다. 사용자에게 승인 대기함에서 검토 후 승인해 달라고 안내하세요.',
      approvalId: approval.id,
    };
  }

  if (toolName === 'generate_clinic_worksheet') {
    const sheet = {
      id: 'cl_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      createdAt: '방금 AI 에이전트 생성',
      targetGroup: args.targetGroup,
      topic: args.topic,
      questions: args.questions || [],
    };
    effects.worksheets.push(sheet);
    effects.audits.push(`[클리닉·보강 문항 생성] "${sheet.targetGroup} — ${sheet.topic}" (${sheet.questions.length}문항)`);
    return { status: 'WORKSHEET_CREATED', questionCount: sheet.questions.length, topic: sheet.topic };
  }

  if (toolName === 'save_workspace_memory') {
    const mem = {
      id: 'm_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      cat: args.category || '평가·수업 원칙',
      date: '방금 AI 에이전트 저장',
      sensitive: Boolean(args.sensitive),
      text: args.text,
    };
    effects.memories.push(mem);
    effects.audits.push(`[기억장 저장] (${mem.cat}) "${mem.text.slice(0, 28)}…"`);
    return { status: 'MEMORY_SAVED', category: mem.cat };
  }

  return { error: `Unknown tool: ${toolName}` };
}

function buildSystemPrompt(preset, role) {
  const presetDesc = {
    academy_director:
      '당신은 학원 운영자(원장·상담실장)를 돕는 로컬 AI 운영 조교 "에듀노드(EduNod)"입니다. 원생 등·하원 출결 케어, 수강료(원비) 미납/재등록 정중 안내, 신규 입학 레벨테스트 상담 브리핑, 휴·퇴원 위험군 조기 감지 및 강사 시간표/보강 조율을 전담합니다.',
    academy_instructor:
      '당신은 학원 전임·단과 강사를 돕는 로컬 AI 수업·클리닉 조교 "에듀노드(EduNod)"입니다. 반별 일일 수업 진도·과제·테스트 결과를 바탕으로 한 학부모 피드백 알림톡 초안 작성, 커트라인 미달 원생 오답 클리닉/보강 문항 생성, 인근 학교 내신 시험범위 정리를 전담합니다.',
    k12:
      '당신은 초·중·고 담임 및 교과 교사를 돕는 로컬 AI 조교 "에듀노드(EduNod)"입니다. 등교 전 수업·학부모 상담 브리핑, 수행평가 미제출 독려 초안, 형성평가 문항 설계, 학생 개인정보 로컬 보호를 최우선으로 수행합니다.',
    univ:
      '당신은 대학 교수 및 연구실 조교(TA)를 돕는 로컬 AI 학술·강의 조교 "에듀노드(EduNod)"입니다. LMS 질의응답 초안, 강의계획서 기반 채점 기준 안내, 오피스아워 면담 브리핑, 연구실 세미나 행정을 수행합니다.',
  }[preset] || '당신은 교육 전문 로컬 AI 조교 에듀노드(EduNod)입니다.';

  const roleRule =
    role === 'ta'
      ? '현재 사용자는 [강사/부담임/수업조교(제한 권한)]입니다. 원비 수납 금액이나 원장/담임 전용 민감 상담 기록은 열람할 수 없으며, 모든 외부 메시지는 원장/담임 결재 상신용으로만 작성합니다.'
      : '현재 사용자는 [원장/담임교사/담당교수(최종 승인권자)]입니다.';

  return [
    presetDesc,
    roleRule,
    '핵심 행동 수칙:',
    '1. 질문에 답하기 전 필요한 경우 반드시 `query_workspace_records` 도구를 호출해 실제 원생/학생 명단, 출결, 점수, 미납 상태, 기억장 원칙을 먼저 확인하세요.',
    '2. 학부모 문자/알림톡, 수강료 안내, 보강 알림, LMS 공지 등 외부 발송 초안 요청이 있으면 반드시 `propose_external_message` 도구를 호출해 승인 대기함(Trust Queue)에 카드를 생성하세요. 절대 임의로 발송 완료했다고 거짓말하지 마세요.',
    '3. 브리핑 요청 시 `create_briefing` 도구를 호출해 구조화된 브리핑 카드를 생성하세요.',
    '4. 오답 클리닉 문제, 보강 학습지, 형성평가 문항 요청 시 `generate_clinic_worksheet` 도구를 호출해 실제 문제와 해설을 생성하세요.',
    '5. 기억해 달라는 운영 규칙이나 학생 특성은 `save_workspace_memory` 도구를 호출해 저장하세요.',
    '6. 최종 한국어 답변은 간결하고 명확하며 교육 현장에 어울리는 품격 있는 어조로 작성하세요.',
  ].join('\n');
}

// ---------- Provider 1: Google Gemini (Native Function Calling) ----------
async function runGeminiAgent({ apiKey, systemPrompt, history, userMessage, ctx }) {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastErr = null;

  for (const modelName of modelsToTry) {
    try {
      const contents = [];
      for (const h of history.slice(-8)) {
        if (!h.text) continue;
        contents.push({
          role: h.who === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const functionDeclarations = AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));

      let totalTokens = 0;
      let finalReply = '';

      for (let step = 0; step < 4; step++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
              tools: [{ functionDeclarations }],
              generationConfig: { temperature: 0.35 },
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
        }

        totalTokens +=
          (data?.usageMetadata?.promptTokenCount || 0) + (data?.usageMetadata?.candidatesTokenCount || 0);

        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const fnCalls = parts.filter((p) => p.functionCall);

        if (fnCalls.length === 0) {
          finalReply = parts
            .map((p) => p.text || '')
            .join('\n')
            .trim();
          break;
        }

        contents.push({ role: 'model', parts });
        const responseParts = [];
        for (const fc of fnCalls) {
          const { name, args } = fc.functionCall;
          const result = executeWorkspaceTool(name, args || {}, ctx);
          responseParts.push({
            functionResponse: {
              name,
              response: { result },
            },
          });
        }
        contents.push({ role: 'user', parts: responseParts });
      }

      const estimatedKrw = Math.max(12, Math.round((totalTokens / 1000) * 1.2));
      return {
        provider: `Google ${modelName}`,
        reply: finalReply || '요청하신 작업을 워크스페이스에 반영했습니다. 상단 탭과 승인 대기함을 확인해 주세요.',
        tokens: totalTokens,
        costKrw: estimatedKrw,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini 호출 실패');
}

// ---------- Provider 2: Anthropic Claude (Native Tool Use) ----------
async function runAnthropicAgent({ apiKey, systemPrompt, history, userMessage, ctx }) {
  const modelsToTry = ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest'];
  let lastErr = null;

  for (const modelName of modelsToTry) {
    try {
      const messages = [];
      for (const h of history.slice(-8)) {
        if (!h.text) continue;
        const role = h.who === 'user' ? 'user' : 'assistant';
        if (messages.length && messages[messages.length - 1].role === role) {
          messages[messages.length - 1].content += '\n' + h.text;
        } else {
          messages.push({ role, content: h.text });
        }
      }
      if (messages.length && messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += '\n' + userMessage;
      } else {
        messages.push({ role: 'user', content: userMessage });
      }
      if (messages[0]?.role !== 'user') {
        messages.shift();
      }

      const tools = AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      let totalTokens = 0;
      let finalReply = '';

      for (let step = 0; step < 4; step++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 1800,
            system: systemPrompt,
            tools,
            messages,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
        }

        totalTokens += (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0);
        const contentBlocks = data?.content || [];
        const toolUses = contentBlocks.filter((b) => b.type === 'tool_use');

        if (toolUses.length === 0) {
          finalReply = contentBlocks
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
          break;
        }

        messages.push({ role: 'assistant', content: contentBlocks });
        const toolResults = [];
        for (const tu of toolUses) {
          const result = executeWorkspaceTool(tu.name, tu.input || {}, ctx);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: 'user', content: toolResults });
      }

      const estimatedKrw = Math.max(20, Math.round((totalTokens / 1000) * 6.5));
      return {
        provider: `Anthropic ${modelName}`,
        reply: finalReply || '요청하신 작업을 워크스페이스에 반영했습니다.',
        tokens: totalTokens,
        costKrw: estimatedKrw,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Anthropic 호출 실패');
}

// ---------- Provider 3: OpenAI / OpenRouter / Local Ollama ----------
async function runOpenAICompatibleAgent({ baseUrl, apiKey, modelName, systemPrompt, history, userMessage, ctx, isFreeLocal }) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of history.slice(-6)) {
    if (!h.text) continue;
    messages.push({ role: h.who === 'user' ? 'user' : 'assistant', content: h.text });
  }
  messages.push({ role: 'user', content: userMessage });

  const tools = AGENT_TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  let totalTokens = 0;
  let finalReply = '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  for (let step = 0; step < 4; step++) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages,
        tools,
        temperature: 0.35,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Compatible HTTP ${res.status}`);

    totalTokens += data?.usage?.total_tokens || 0;
    const msg = data?.choices?.[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalReply = (msg.content || '').trim();
      break;
    }

    messages.push(msg);
    for (const tc of msg.tool_calls) {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(tc.function?.arguments || '{}');
      } catch {}
      const result = executeWorkspaceTool(tc.function.name, parsedArgs, ctx);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    provider: isFreeLocal ? `로컬 서버 (${modelName})` : modelName,
    reply: finalReply || '요청하신 작업을 완료했습니다.',
    tokens: totalTokens,
    costKrw: isFreeLocal ? 0 : Math.max(15, Math.round((totalTokens / 1000) * 3)),
  };
}

export async function runEduNodAgent(payload, customHeaders = {}) {
  const {
    preset = 'academy_director',
    role = 'owner',
    preferredProvider = 'auto',
    userMessage = '',
    history = [],
    workspace = {},
  } = payload || {};

  if (!userMessage.trim()) {
    throw new Error('지시할 메시지를 입력해 주세요.');
  }

  const creds = loadCredentials(customHeaders);
  const { geminiKey, anthropicKey, openaiKey, openrouterKey, localUrl } = creds._secrets;

  const effects = {
    briefings: [],
    approvals: [],
    worksheets: [],
    memories: [],
    audits: [],
  };
  const ctx = { preset, role, workspace, effects };
  const systemPrompt = buildSystemPrompt(preset, role);

  // Build ordered provider candidates with automatic failover
  const candidates = [];
  const addCandidate = (id) => {
    if (candidates.includes(id)) return;
    if (id === 'gemini' && geminiKey) candidates.push('gemini');
    if (id === 'anthropic' && anthropicKey) candidates.push('anthropic');
    if (id === 'openai' && openaiKey) candidates.push('openai');
    if (id === 'openrouter' && openrouterKey) candidates.push('openrouter');
    if (id === 'local' && localUrl) candidates.push('local');
  };

  if (preferredProvider && preferredProvider !== 'auto') {
    addCandidate(preferredProvider);
  }
  ['gemini', 'anthropic', 'openai', 'openrouter', 'local'].forEach(addCandidate);

  if (candidates.length === 0) {
    throw new Error(
      '연결된 AI 모델 키나 로컬 LLM 서버가 없습니다. 상단 [에이전트 연결 설정]에서 API 키 또는 로컬 Ollama 주소를 입력해 주세요.'
    );
  }

  let lastError = null;
  for (const cand of candidates) {
    try {
      let out;
      if (cand === 'gemini') {
        out = await runGeminiAgent({ apiKey: geminiKey, systemPrompt, history, userMessage, ctx });
      } else if (cand === 'anthropic') {
        out = await runAnthropicAgent({ apiKey: anthropicKey, systemPrompt, history, userMessage, ctx });
      } else if (cand === 'openai') {
        out = await runOpenAICompatibleAgent({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: openaiKey,
          modelName: 'gpt-4o-mini',
          systemPrompt,
          history,
          userMessage,
          ctx,
          isFreeLocal: false,
        });
      } else if (cand === 'openrouter') {
        out = await runOpenAICompatibleAgent({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: openrouterKey,
          modelName: 'anthropic/claude-3.5-sonnet',
          systemPrompt,
          history,
          userMessage,
          ctx,
          isFreeLocal: false,
        });
      } else if (cand === 'local') {
        out = await runOpenAICompatibleAgent({
          baseUrl: localUrl,
          apiKey: customHeaders.localKey || '',
          modelName: customHeaders.localModel || 'llama3.1',
          systemPrompt,
          history,
          userMessage,
          ctx,
          isFreeLocal: true,
        });
      }

      return {
        ok: true,
        provider: out.provider,
        reply: out.reply,
        tokens: out.tokens,
        costKrw: out.costKrw,
        effects,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('모든 연결된 모델 프로바이더 호출이 실패했습니다.');
}
