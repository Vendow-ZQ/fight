const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BattleEvent =
  | { type: 'round_start'; round: number }
  | { type: 'agent_start'; agentId: string; agentName: string; round: number }
  | { type: 'token'; agentId: string; token: string }
  | { type: 'agent_done'; agentId: string; fullText: string }
  | { type: 'round_end'; round: number }
  | { type: 'battle_end'; roundsCompleted: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSseEvent(eventType: string, data: unknown): BattleEvent | null {
  const d = data as Record<string, unknown>;
  switch (eventType) {
    case 'round_start':
      return { type: 'round_start', round: d.round as number };
    case 'agent_start':
      return {
        type: 'agent_start',
        agentId: d.agent_id as string,
        agentName: d.agent_name as string,
        round: d.round as number,
      };
    case 'token':
      return { type: 'token', agentId: d.agent_id as string, token: d.token as string };
    case 'agent_done':
      return { type: 'agent_done', agentId: d.agent_id as string, fullText: d.full_text as string };
    case 'round_end':
      return { type: 'round_end', round: d.round as number };
    case 'battle_end':
      return { type: 'battle_end', roundsCompleted: d.rounds_completed as number };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// startBattle
// ---------------------------------------------------------------------------

export async function startBattle(params: {
  topic: string;
  kolIds: string[];
  rounds: number;
  maxTokens?: number;
  length?: string;
}): Promise<{ battleId: string }> {
  const res = await fetch(`${API_BASE}/api/battle/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: params.topic,
      kol_ids: params.kolIds,
      rounds: params.rounds,
      ...(params.maxTokens != null && { max_tokens: params.maxTokens }),
      ...(params.length != null && { length: params.length }),
    }),
  });
  if (!res.ok) throw new Error(`startBattle failed: ${res.status}`);
  const json = await res.json();
  return { battleId: json.battle_id };
}

// ---------------------------------------------------------------------------
// streamBattle  (GET SSE via EventSource)
// ---------------------------------------------------------------------------

export function streamBattle(
  battleId: string,
  onEvent: (event: BattleEvent) => void,
  onError?: (message: string) => void,
): { close: () => void } {
  const es = new EventSource(`${API_BASE}/api/battle/${battleId}/stream`);

  const eventTypes = [
    'round_start',
    'agent_start',
    'token',
    'agent_done',
    'round_end',
    'battle_end',
  ] as const;

  for (const t of eventTypes) {
    es.addEventListener(t, (e: MessageEvent) => {
      const parsed = parseSseEvent(t, JSON.parse(e.data));
      if (parsed) onEvent(parsed);
    });
  }

  es.addEventListener('error', (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data);
      onError?.(d.message || '对局流出错');
    } catch {
      onError?.('对局流出错');
    }
    es.close();
  });

  es.onerror = () => {
    onError?.('连接中断');
    es.close();
  };

  return {
    close: () => es.close(),
  };
}

// ---------------------------------------------------------------------------
// injectOpinion
// ---------------------------------------------------------------------------

export async function injectOpinion(battleId: string, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/battle/${battleId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`injectOpinion failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// summarizeBattle
// ---------------------------------------------------------------------------

export async function summarizeBattle(
  battleId: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/battle/${battleId}/summarize`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`summarizeBattle failed: ${res.status}`);
  const json = await res.json();
  return json.summaries as Record<string, string>;
}

// ---------------------------------------------------------------------------
// distillKol  — create a new KOL via distillation
// ---------------------------------------------------------------------------

export async function distillKol(data: {
  mode: string
  url: string
  platform: string
  name: string
  domains: string[]
  file?: File | null
  avatarFile?: File | null
}): Promise<{ id: string; name: string; title: string; tags: string[]; color: string; bgColor: string }> {
  const form = new FormData()
  form.append('mode', data.mode)
  form.append('url', data.url)
  form.append('platform', data.platform)
  form.append('name', data.name)
  form.append('domains', JSON.stringify(data.domains))
  if (data.file) form.append('file', data.file)
  if (data.avatarFile) form.append('avatar', data.avatarFile)

  const res = await fetch(`${API_BASE}/api/kols/distill`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `distillKol failed: ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// fetchKols  — get current KOL list from server
// ---------------------------------------------------------------------------

export async function fetchKols(): Promise<
  { id: string; name: string; title: string; tags: string[]; color: string; bgColor: string }[]
> {
  const res = await fetch(`${API_BASE}/api/kols`)
  if (!res.ok) throw new Error(`fetchKols failed: ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// deleteKol  — remove a distilled KOL
// ---------------------------------------------------------------------------

export async function deleteKol(kolId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/kols/${kolId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `deleteKol failed: ${res.status}`)
  }
}

// ---------------------------------------------------------------------------
// streamSummarize  (POST + SSE via fetch ReadableStream)
// ---------------------------------------------------------------------------

export type SummaryEvent =
  | { type: 'summary_start'; agentId: string; agentName: string }
  | { type: 'summary_token'; agentId: string; token: string }
  | { type: 'summary_done'; agentId: string; fullText: string }
  | { type: 'summarize_end' };

function parseSummaryEvent(eventType: string, data: unknown): SummaryEvent | null {
  const d = data as Record<string, unknown>;
  switch (eventType) {
    case 'summary_start':
      return { type: 'summary_start', agentId: d.agent_id as string, agentName: d.agent_name as string };
    case 'summary_token':
      return { type: 'summary_token', agentId: d.agent_id as string, token: d.token as string };
    case 'summary_done':
      return { type: 'summary_done', agentId: d.agent_id as string, fullText: d.full_text as string };
    case 'summarize_end':
      return { type: 'summarize_end' };
    default:
      return null;
  }
}

export function streamSummarize(
  battleId: string,
  onEvent: (event: SummaryEvent) => void,
): { close: () => void } {
  const controller = new AbortController();

  (async () => {
    const res = await fetch(`${API_BASE}/api/battle/${battleId}/summarize-stream`, {
      method: 'POST',
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw || !currentEvent) continue;
          const parsed = parseSummaryEvent(currentEvent, JSON.parse(raw));
          if (parsed) onEvent(parsed);
          currentEvent = '';
        }
      }
    }
  })().catch(() => {});

  return {
    close: () => controller.abort(),
  };
}

// ---------------------------------------------------------------------------
// streamContinue  (POST + SSE via fetch ReadableStream)
// ---------------------------------------------------------------------------

export function streamContinue(
  battleId: string,
  onEvent: (event: BattleEvent) => void,
): { close: () => void } {
  const controller = new AbortController();

  (async () => {
    const res = await fetch(`${API_BASE}/api/battle/${battleId}/continue`, {
      method: 'POST',
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw || !currentEvent) continue;
          const parsed = parseSseEvent(currentEvent, JSON.parse(raw));
          if (parsed) onEvent(parsed);
          currentEvent = '';
        }
      }
    }
  })().catch(() => {});

  return {
    close: () => controller.abort(),
  };
}
