export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

type ApiFormat = 'openai' | 'anthropic';

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  apiFormat: ApiFormat;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function detectApiFormat(baseUrl: string): ApiFormat {
  const configured = process.env.MIMO_API_FORMAT?.toLowerCase();
  if (configured === 'anthropic' || configured === 'openai') return configured;
  return baseUrl.toLowerCase().includes('/anthropic') ? 'anthropic' : 'openai';
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
      apiFormat: 'openai',
    };
  }

  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL;
  const model = process.env.MIMO_MODEL;
  if (!apiKey || !baseUrl || !model) {
    throw new Error('Missing MIMO_API_KEY, MIMO_BASE_URL, or MIMO_MODEL');
  }

  return {
    apiKey,
    baseUrl,
    model,
    apiFormat: detectApiFormat(baseUrl),
  };
}

function encodeSseText(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\n`;
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

function openaiUrl(baseUrl: string): string {
  return `${trimTrailingSlash(baseUrl)}/chat/completions`;
}

function anthropicUrl(baseUrl: string): string {
  const clean = trimTrailingSlash(baseUrl);
  if (clean.endsWith('/v1/messages') || clean.endsWith('/messages')) return clean;
  if (clean.endsWith('/v1')) return `${clean}/messages`;
  return `${clean}/v1/messages`;
}

function extractOpenAiDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choice = (payload as { choices?: unknown[] }).choices?.[0] as
    | { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown }
    | undefined;
  const content = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
  return typeof content === 'string' ? content : '';
}

function extractAnthropicDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as {
    type?: unknown;
    delta?: { text?: unknown };
    content_block?: { text?: unknown };
  };

  const deltaText = data.delta?.text;
  if (typeof deltaText === 'string') return deltaText;

  const blockText = data.content_block?.text;
  if (data.type === 'content_block_start' && typeof blockText === 'string') return blockText;

  return '';
}

function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n');

  const chatMessages = messages
    .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant',
    )
    .map(message => ({
      role: message.role,
      content: message.content,
    }));

  return {
    system: system || undefined,
    messages: chatMessages.length
      ? chatMessages
      : [{ role: 'user', content: '请根据已提供的信息进行紫微斗数解读。' }],
  };
}

async function fetchOpenAiStream(config: ProviderConfig, messages: ChatMessage[]): Promise<Response> {
  return fetch(openaiUrl(config.baseUrl), {
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
}

async function fetchAnthropicStream(config: ProviderConfig, messages: ChatMessage[]): Promise<Response> {
  const body = toAnthropicMessages(messages);
  return fetch(anthropicUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      ...body,
      max_tokens: 2200,
      stream: true,
      temperature: 0.65,
    }),
  });
}

async function proxySseStream(
  upstream: Response,
  extractDelta: (payload: unknown) => string,
): Promise<Response> {
  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => '');
    return createErrorStream(`AI service request failed: ${upstream.status} ${errorText.slice(0, 300)}`, upstream.status);
  }

  if (!upstream.body) {
    return createErrorStream('AI service did not return a readable stream.', 502);
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

export async function streamChatCompletion(messages: ChatMessage[]): Promise<Response> {
  let config: ProviderConfig;
  try {
    config = getProviderConfig();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'AI configuration error';
    return createErrorStream(`AI 配置不完整：${detail}`, 500);
  }

  if (config.apiFormat === 'anthropic') {
    const upstream = await fetchAnthropicStream(config, messages);
    return proxySseStream(upstream, extractAnthropicDelta);
  }

  const upstream = await fetchOpenAiStream(config, messages);
  return proxySseStream(upstream, extractOpenAiDelta);
}
