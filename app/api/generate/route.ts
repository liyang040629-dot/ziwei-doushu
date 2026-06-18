import { NextRequest, NextResponse } from 'next/server';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

function isBirthInfo(value: unknown): value is BirthInfo {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<BirthInfo>;
  return (
    typeof data.year === 'number' &&
    typeof data.month === 'number' &&
    typeof data.day === 'number' &&
    typeof data.hour === 'number' &&
    (data.gender === 'male' || data.gender === 'female')
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isBirthInfo(body)) {
      return NextResponse.json({ error: '出生信息不完整。' }, { status: 400 });
    }

    return NextResponse.json(generateChart(body));
  } catch {
    return NextResponse.json({ error: '生成命盘失败。' }, { status: 500 });
  }
}
