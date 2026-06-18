export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.AI_PROVIDER || 'mimo').toLowerCase();

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY');
    return {
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }

  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL;
  const model = process.env.MIMO_MODEL;
  if (!apiKey || !baseUrl || !model) {
    throw new Error('Missing MIMO_API_KEY, MIMO_BASE_URL, or MIMO_MODEL');
  }

  return { apiKey, baseUrl, model };
}

function encodeSseText(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\n`;
}

function extractDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choice = (payload as { choices?: unknown[] }).choices?.[0] as
    | { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown }
    | undefined;
  const content = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
  return typeof content === 'string' ? content : '';
}

function createErrorStream(message: string, status = 500): Response {
  return new Response(encodeSseText(message) + 'data: [DONE]\n\n', {
    status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function streamChatCompletion(messages: ChatMessage[]): Promise<Response> {
  let config: ProviderConfig;
  try {
    config = getProviderConfig();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'AI configuration error';
    return createErrorStream(`AI 配置不完整：${detail}`, 500);
  }

  const upstream = await fetch(`${trimTrailingSlash(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.65,
    }),
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => '');
    return createErrorStream(`AI 服务请求失败：${upstream.status} ${errorText.slice(0, 300)}`, upstream.status);
  }

  if (!upstream.body) {
    return createErrorStream('AI 服务没有返回可读取的数据流。', 502);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const delta = extractDelta(JSON.parse(data));
              if (delta) controller.enqueue(encoder.encode(encodeSseText(delta)));
            } catch {
              // Ignore malformed upstream chunks and keep the stream alive.
            }
          }
        }
      } catch {
        controller.enqueue(encoder.encode(encodeSseText('AI 连接中断，请稍后重试。')));
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
