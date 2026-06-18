import type { Palace, ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { detectPatterns, getMingGongSummary } from '@/lib/ziwei/patterns';

function palaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
  return chart.palaces.find(p => p.branch === branch);
}

function starList(palace?: Palace): string {
  if (!palace) return '无';
  const stars = palace.stars.map(s => `${s.name}${s.siHua ? `化${s.siHua}` : ''}`);
  return stars.length ? stars.join('、') : '无主星';
}

function palaceLine(palace: Palace): string {
  const labels = [
    palace.isMingGong ? '命宫' : '',
    palace.isShenGong ? '身宫' : '',
    palace.isCurrentDaXian ? '当前大限' : '',
  ].filter(Boolean);
  const ganzhi = `${STEMS[palace.stem] ?? ''}${BRANCHES[palace.branch] ?? ''}`;
  const borrowed = palace.isEmpty && palace.borrowedFromName
    ? `；空宫借${palace.borrowedFromName}：${palace.borrowedStars?.join('、') || '无'}`
    : '';
  return `${palace.name}(${ganzhi}${labels.length ? `；${labels.join('；')}` : ''})：${starList(palace)}${borrowed}`;
}

export function summarizeChart(chart: ZiweiChart): string {
  const ming = palaceByBranch(chart, chart.mingGongBranch);
  const shen = palaceByBranch(chart, chart.shenGongBranch);
  const summary = getMingGongSummary(chart);
  const patterns = detectPatterns(chart).slice(0, 8);
  const currentDaXian = chart.daXians[chart.currentDaXianIndex];

  return [
    `姓名：${chart.birthInfo.name || '未填写'}`,
    `性别：${chart.birthInfo.gender === 'male' ? '男' : '女'}`,
    `阳历生日：${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}，时辰序号：${chart.birthInfo.hour}`,
    `农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? '闰' : ''}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日`,
    `当前虚岁/年龄参考：${chart.currentAge}`,
    `五行局：${chart.wuxingJuName}`,
    `命宫：${ming?.name ?? '未知'}，主星：${summary.stars.join('、') || '无主星'}，关键词：${summary.keywords.join('、') || '无'}`,
    `身宫：${shen?.name ?? '未知'}，星曜：${starList(shen)}`,
    currentDaXian ? `当前大限：${currentDaXian.startAge}-${currentDaXian.endAge}岁，落${currentDaXian.palaceName}` : '当前大限：未知',
    patterns.length
      ? `已识别格局：${patterns.map(p => `${p.name}(${p.level})：${p.description}`).join('\n')}`
      : '已识别格局：暂无明显格局',
    '十二宫：',
    ...chart.palaces.map(palaceLine),
  ].join('\n');
}

export function buildZiweiSystemPrompt(): string {
  return [
    '你是一位谨慎、温和、专业的紫微斗数解读助手。',
    '请基于用户提供的结构化命盘做分析，不要声称自己能绝对预测命运。',
    '输出使用简体中文，结构清晰，避免恐吓式断语；涉及健康、投资、婚姻重大决策时，要给出理性提醒。',
    '可以引用紫微斗数传统术语，但必须解释成现代人能理解的话。',
    '如果信息不足，请说明缺口，并基于已有命盘给出有限判断。',
  ].join('\n');
}
