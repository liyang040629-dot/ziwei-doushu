import { NextRequest } from 'next/server';
import type { ChatMessage } from '@/lib/ai/provider';
import { streamChatCompletion } from '@/lib/ai/provider';
import { buildZiweiSystemPrompt, summarizeChart } from '@/lib/ai/ziwei-context';
import { HEMING_METHODOLOGY } from '@/lib/ziwei/heming-knowledge';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    chartA?: ZiweiChart;
    chartB?: ZiweiChart;
    question?: unknown;
  };
  const chartA = body.chartA;
  const chartB = body.chartB;
  const question = typeof body.question === 'string' ? body.question.trim() : '';

  if (!chartA?.palaces?.length || !chartB?.palaces?.length) {
    return new Response('合盘需要两张完整命盘。', { status: 400 });
  }

  const task = question || [
    '请做一次完整合盘分析，按以下结构输出：',
    '**【总体匹配】**：给出一句话结论和五星评分。',
    '**【双方命格】**：比较两人的命宫、身宫、福德宫与行动模式。',
    '**【夫妻宫互参】**：分析双方夫妻宫与对方命宫是否对应。',
    '**【相处风险】**：指出容易产生误会、压力或冲突的地方。',
    '**【长期建议】**：给出具体、可执行的相处建议。',
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: `${buildZiweiSystemPrompt()}\n\n你现在处理的是双人合盘。合盘只用于关系观察和沟通建议，不作绝对婚恋结论。` },
    { role: 'user', content: `合盘方法论参考：\n${HEMING_METHODOLOGY}` },
    { role: 'user', content: `甲方命盘：\n${summarizeChart(chartA)}\n\n乙方命盘：\n${summarizeChart(chartB)}` },
    { role: 'user', content: task },
  ];

  return streamChatCompletion(messages);
}
