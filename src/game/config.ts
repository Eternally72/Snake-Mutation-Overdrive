import type { EffectKind, GeneColor, SkillKind, UpgradeDef, UpgradeId } from './types';

export const GRID = 20;
export const BASE_SPEED = 7;
export const MAX_SPEED = 12;
export const MIN_SNAKE_LENGTH = 3;
export const MAX_CHAIN = 5;
export const MAX_PARTICLES = 420;
export const MAX_TOTAL_MULTIPLIER = 24;

export const COLORS = {
  bg: '#090E1A',
  board: '#111A2B',
  gridLine: '#1B2940',
  red: '#FF5365',
  blue: '#43BFFF',
  green: '#4EF1A3',
  gold: '#FFC857',
  purple: '#B176FF',
  text: '#EDF4FF',
  dim: '#7C8DB5',
};

export const GENE_COLORS: Record<GeneColor, string> = {
  red: COLORS.red,
  blue: COLORS.blue,
  green: COLORS.green,
};

export const GENE_NAMES: Record<GeneColor, string> = {
  red: '狂热',
  blue: '幻影',
  green: '蜕变',
};

export const BASE_BEAN_SCORE = 10;

// multiplier per chain count (index = count-1), before upgrades
export const CHAIN_MULT = [1, 1.4, 1.8, 2.4, 3.2];

export const CHAIN_TITLES: Record<GeneColor, string[]> = {
  red: ['', '火花', '灼烧', '暴走', '赤焰形态'],
  blue: ['', '冷凝', '相位蓄能', '残影', '幽体形态'],
  green: ['', '增殖', '代谢', '再生', '异化形态'],
};

// ---- timed effect durations (seconds) ----
export const EFFECT_DURATION: Record<EffectKind, number> = {
  burn: 6,
  berserk: 5,
  flame: 8,
  condense: 3.5,
  afterimage: 6,
  ghost: 8,
  proliferate: 0.1,
  metabolize: 0.1,
  regen: 0.1,
  alien: 8,
  magnet: 4.5,
  slow: 5,
  resonanceBoost: 10,
};

// score multiplier contributed by each active effect
export const EFFECT_SCORE_MULT: Partial<Record<EffectKind, number>> = {
  burn: 1.5,
  berserk: 1.8,
  flame: 2.5,
  alien: 1.4,
  resonanceBoost: 1.5,
};

export const EFFECT_LABELS: Record<EffectKind, string> = {
  burn: '灼烧',
  berserk: '暴走',
  flame: '赤焰形态',
  condense: '冷凝',
  afterimage: '残影',
  ghost: '幽体形态',
  proliferate: '增殖',
  metabolize: '代谢',
  regen: '再生',
  alien: '异化形态',
  magnet: '基因磁吸',
  slow: '时间缓流',
  resonanceBoost: '极彩共鸣',
};

// ---- beans ----
export const SKILL_MAX_CHARGES_BASE = 3;
export const SKILL_BEAN_CHANCE = 0.16; // per eat when no skill bean on board
export const RAINBOW_CHANCE = 0.08;
export const CLONE_CHANCE = 0.05;
export const CROWN_CHANCE = 0.028;
export const CROWN_COOLDOWN = 45; // seconds between crowns
export const GENE_BEAN_TARGET = 4; // gene beans kept on board (excluding colored minimums)
export const GENE_STORM_EXTRA = 3;

// ---- skills ----
export const SKILL_NAMES: Record<SkillKind, string> = {
  dash: '极速冲刺',
  magnet: '基因磁吸',
  slow: '时间缓流',
  shed: '断尾蜕皮',
};

export const SKILL_DESCS: Record<SkillKind, string> = {
  dash: '向当前方向高速突进 3 格，吞噬路径上的豆子。路径被阻挡时无法发动。',
  magnet: '短时间内自动吸收蛇头附近的豆子。',
  slow: '短时间内大幅降低移动速度。',
  shed: '立即舍弃约 25% 的蛇尾，换取分数与空间。',
};

export const DASH_DISTANCE = 3;
export const MAGNET_RADIUS = 4.5;
export const SHED_FRACTION = 0.25;
export const SHED_SCORE_PER_SEGMENT = 20;

// ---- speed modifiers ----
export const SLOW_FACTOR = 0.55; // time-slow skill & condense
export const COLD_CORE_SLOW_FACTOR = 0.42;
export const BERSERK_SPEED_BONUS = 2.2;
export const SPEED_SCORE_RAMP = 1600; // score needed to reach max base speed

// ---- shields ----
export const SHIELD_CAP_BASE = 2;

// ---- upgrades ----
export const UPGRADES: UpgradeDef[] = [
  { id: 'redAmp', name: '赤红增幅', desc: '红色基因豆得分倍率 +50%。', school: 'red', maxLevel: 3 },
  { id: 'flameCore', name: '烈焰核心', desc: '赤焰形态持续时间 +4 秒。', school: 'red', maxLevel: 2 },
  { id: 'extremeFever', name: '极限狂热', desc: '红色 5 连时得分倍率额外 ×1.5，但移动速度 +0.8。', school: 'red', maxLevel: 1 },
  { id: 'coldCore', name: '寒潮核心', desc: '蓝色减速效果更强（速度降至 42%）。', school: 'blue', maxLevel: 2 },
  { id: 'phaseArmor', name: '相位装甲', desc: '护盾上限 +2，蓝色变异额外获得 1 层护盾。', school: 'blue', maxLevel: 2 },
  { id: 'ghostExtend', name: '幽体延展', desc: '幽体形态持续时间 +4 秒。', school: 'blue', maxLevel: 2 },
  { id: 'wildGrowth', name: '野蛮生长', desc: '绿色基因豆额外 +1 成长，得分 +20%。', school: 'green', maxLevel: 2 },
  { id: 'efficientMetabolism', name: '高效代谢', desc: '缩短蛇尾时获得的分数 +100%。', school: 'green', maxLevel: 2 },
  { id: 'shedExpert', name: '蜕皮专家', desc: '断尾类效果增强：舍弃比例提升至 35%，分数翻倍。', school: 'green', maxLevel: 1 },
  { id: 'chainAmp', name: '连锁增幅', desc: '同色连锁各档位倍率 +15%。', school: 'chain', maxLevel: 3 },
  { id: 'geneMemory', name: '基因记忆', desc: '每局第一次切换颜色时，保留一半的上一颜色连锁进度。', school: 'chain', maxLevel: 1 },
  { id: 'rainbowResonance', name: '极彩共鸣', desc: '一局内达成红、蓝、绿三种 3 连后：+800 分，且 10 秒内得分 ×1.5。', school: 'chain', maxLevel: 1 },
  { id: 'goldenGluttony', name: '黄金吞噬', desc: '豆子基础分数 +5。', school: 'general', maxLevel: 3 },
  { id: 'skillCharge', name: '技能充能', desc: '主动技能最大充能 +2。', school: 'general', maxLevel: 2 },
  { id: 'secondLife', name: '第二生命', desc: '每局抵消一次致命碰撞（原地冻结，需转向脱险）。', school: 'general', maxLevel: 1 },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

export function upgradeThreshold(index: number): number {
  // escalating milestones: 250, 620, 1130, 1830, 2760, ...
  let t = 0;
  let step = 250;
  for (let i = 0; i <= index; i++) {
    t += step;
    step = Math.round(step * 1.42 + 40);
  }
  return t;
}

// ---- events ----
export const EVENT_DEFS = {
  geneStorm: { name: '基因风暴', duration: 12, desc: '普通基因豆数量增加！' },
  goldenTime: { name: '黄金时刻', duration: 10, desc: '吞噬得分 ×2！' },
  rainbowTide: { name: '彩虹潮汐', duration: 12, desc: '彩虹豆出现概率提升！' },
} as const;

export const EVENT_FIRST_DELAY = 28;
export const EVENT_GAP_MIN = 32;
export const EVENT_GAP_MAX = 50;
export const GOLDEN_TIME_MULT = 2;
export const RAINBOW_TIDE_MULT = 3;
