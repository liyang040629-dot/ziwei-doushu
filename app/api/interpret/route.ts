import { NextRequest } from 'next/server';
import type { ChatMessage } from '@/lib/ai/provider';
import { streamChatCompletion } from '@/lib/ai/provider';
import { buildZiweiSystemPrompt, summarizeChart } from '@/lib/ai/ziwei-context';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ClientMessage>;
  return (data.role === 'user' || data.role === 'assistant') && typeof data.content === 'string';
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { chart?: ZiweiChart; messages?: unknown };
  const chart = body.chart;
  const clientMessages: ClientMessage[] = Array.isArray(body.messages)
    ? body.messages.filter(isClientMessage).slice(-8)
    : [];

  if (!chart?.palaces?.length) {
    return new Response('命盘数据不完整。', { status: 400 });
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildZiweiSystemPrompt() },
    {
      role: 'user',
      content: `下面是命盘结构化资料，请作为后续解读依据。\n\n${summarizeChart(chart)}`,
    },
    ...clientMessages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  ];

  return streamChatCompletion(messages);
}
