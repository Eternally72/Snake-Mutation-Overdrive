import type {
  BuffKind,
  DebuffKind,
  EffectKind,
  ElementKind,
  GeneColor,
  MorphState,
  SkillKind,
  UpgradeDef,
  UpgradeId,
} from './types';

export const GRID = 64; // world size in cells (64×64 ≈ 10× the original area)
export const VIEW = 21; // cells visible vertically (odd → head centered)
export const VIEW_W = 28; // cells visible horizontally (4:3 viewport)
// 全局节奏调慢：速度类常量为原值的 0.4 倍（体验调整，实测后再定）
export const BASE_SPEED = 2.8;
export const MAX_SPEED = 4.8;
export const MIN_SNAKE_LENGTH = 3;
export const MAX_CHAIN = 5;
export const MAX_PARTICLES = 420;
export const MAX_TOTAL_MULTIPLIER = 24;

// ---- continuous movement (free-angle steering) ----
export const TURN_RATE = 4.5; // rad/s: unchanged while speed is 0.4× → much tighter turn radius (~0.6 cell)
export const SEG_SPACING = 0.75; // cells between adjacent body segments along the trail
export const EAT_RADIUS = 0.6; // head↔bean distance that counts as eaten
export const SELF_HIT_SKIP = 8; // ignore the first N neck segments for self-collision
export const SELF_HIT_DIST = 0.55; // head↔body distance that counts as a self hit
export const WALL_MARGIN = 0.5; // head may reach this far past the outer cell centers
export const HIT_INVULN = 1; // seconds of invulnerability after taking a hit

// ---- combat: score-as-HP + tower bosses + bullets + minions ----
export const BOSS_STEP = 5000; // score interval between boss thresholds
export const BOSS_HP_PER_SCORE = 5.0; // boss HP = BOSS_HP_PER_SCORE × anchorScore
export const BOSS_SPAWN_MIN = 10; // cells from head
export const BOSS_SPAWN_MAX = 14;
export const BOSS_SPAWN_EDGE = 4; // keep the boss this far inside the world bounds
export const BOSS_TELEGRAPH = 1.2; // seconds of warning before a boss activates
export const BOSS_KILL_SCORE_FRAC = 0.25; // reward = frac × anchorScore
export const BOSS_GENE_DROPS = 3; // gene beans scattered on kill (2–3)
export const BOSS_CROWN_CHANCE = 0.5;

// bullets (all speeds in cells/second, damage as a fraction of anchorScore)
export const BULLET_SPEED = 3.6;
export const BULLET_RADIUS = 0.45; // head-only collision radius
export const BULLET_MUZZLE = 0.5; // muzzle-flash telegraph before a shot launches
export const BULLET_LIFE = 8; // seconds before a bullet despawns
export const BOSS_P1_INTERVAL = 1.8;
export const BOSS_P1_DMG = 0.05;
export const BOSS_P2_INTERVAL = 2.2;
export const BOSS_P2_DMG = 0.05;
export const BOSS_P2_SPREAD = 3;
export const BOSS_P3_RING_INTERVAL = 3.0;
export const BOSS_P3_RING_COUNT = 10;
export const BOSS_P3_RING_GAPS = 2;
export const BOSS_P3_RING_DMG = 0.05;
export const BOSS_P3_AIMED_INTERVAL = 1.2;
export const BOSS_P3_AIMED_DMG = 0.05;
export const BOSS_P3_SPECIAL_INTERVAL = 4.0;
export const BOSS_P3_SPECIAL_DMG = 0.08;
export const BOSS_PHASE2_FRAC = 0.66; // HP fraction below which phase 2 starts
export const BOSS_PHASE3_FRAC = 0.33;

// minions (phase 2+)
export const MINION_SUMMON_INTERVAL = 8;
export const MINION_CAP = 4;
export const MINION_PER_SUMMON = 2;
export const MINION_HP_FRAC = 0.2; // HP = frac × anchorScore
export const MINION_SPEED_FRAC = 0.85; // speed = snake speed × frac
export const MINION_RAM_DMG = 0.03;
export const MINION_HIT_RADIUS = 0.5;
export const MINION_KNOCKBACK = 0.5; // cells the head is pushed on a ram
export const MINION_STEER_LOCK = 0.3; // seconds of steering interruption
export const MINION_KILL_SCORE_FRAC = 0.01;
export const MINION_SPAWN_OFFSET = 3; // cells from the boss

// boss movement: wander along an engagement ring around the head (never beelines at it)
export const BOSS_SPEED_FRAC = 0.55; // boss speed = snake speed × frac
export const BOSS_ENGAGE_MIN = 8; // ring radius bounds, cells from head
export const BOSS_ENGAGE_MAX = 12;
export const BOSS_RETARGET_MIN = 2.5; // pick a fresh ring anchor every 2.5–4.5s
export const BOSS_RETARGET_MAX = 4.5;
export const BOSS_WOBBLE = 0.35; // lateral sine wobble, fraction of speed
export const BOSS_HIT_RADIUS = 1.4; // body-contact damage radius
export const BOSS_CONTACT_DMG = 0.05; // × anchorScore
export const BOSS_CONTACT_COOLDOWN = 0.8;

// ambient wild minions: keep pressure between boss fights
export const AMBIENT_FIRST_DELAY = 20; // grace period after run start (s)
export const AMBIENT_INTERVAL_MIN = 7; // spawn cadence bounds (s)
export const AMBIENT_INTERVAL_MAX = 11;
export const AMBIENT_SPAWN_MIN = 16; // cells from head — always outside the 28×21 camera view
export const AMBIENT_SPAWN_MAX = 22;

// obstacles: sparse lethal rubble slabs that also block bullets (cover)
export const OBSTACLE_MIN = 3; // clusters per run
export const OBSTACLE_MAX = 5;
export const OBSTACLE_SIZE_MIN = 3; // rect side bounds, cells
export const OBSTACLE_SIZE_MAX = 5;
export const OBSTACLE_EDGE_GAP = 5; // keep clear of the world border
export const OBSTACLE_SPAWN_GAP = 9; // keep clear of the player spawn point
export const OBSTACLE_SEP = 10; // min gap between clusters

// player attack (mouse-left held; damage anchored to boss anchorScore)
// targeting: every evolved form locks the enemy nearest to the HEAD within
// ATTACK_LOCK_RANGE; beyond that range (or with no morph) bolts fly straight.
export const ATTACK_LOCK_RANGE = 15; // cells — generous, so moving bosses stay hittable
export const ATTACK_BASE_DPS = 0.15;
export const ATTACK_CAP_MULT = 5; // hard cap on stacked element amplification
// base form: plain straight energy bolt, no lock
export const ATTACK_BOLT_INTERVAL = 0.5;
export const ATTACK_BOLT_SPEED = 6.4;
export const ATTACK_BOLT_DMG = 0.075; // per bolt (0.5s × 0.15 dps)
// red炎狱兽: slow, heavy, high-damage homing shells
export const RED_SHOT_INTERVAL = 0.5;
export const RED_SHOT_SPEED = 5.2;
export const RED_SHOT_RADIUS = 0.55;
export const RED_DMG_MULT = 2.2; // damage share vs base dps
// blue渊灵: rapid small homing bolts that freeze-slow on hit
export const BLUE_SHOT_INTERVAL = 0.28;
export const BLUE_SHOT_SPEED = 6.8;
export const BLUE_SHOT_RADIUS = 0.26;
export const BLUE_DMG_MULT = 0.8;
export const FREEZE_DURATION = 2.5; // refreshed on every blue hit
export const FREEZE_MOVE_MULT = 0.55; // boss/minion move speed while frozen
export const FREEZE_FIRE_MULT = 0.75; // boss fire rate while frozen
// green共生体: medium homing bolts that stack a poison DoT
export const GREEN_SHOT_INTERVAL = 0.4;
export const GREEN_SHOT_SPEED = 6.0;
export const GREEN_SHOT_RADIUS = 0.38;
export const GREEN_DMG_MULT = 1.0;
export const POISON_DPS_PER_SEC = 0.015; // × anchorScore × stacks
export const POISON_DURATION = 4;
export const POISON_MAX_STACKS = 5;
export const POISON_KILL_HEAL_FRAC = 0.02; // poison-killing a minion refunds a little score
// prism虹彩巨蛇: twin homing rainbow columns
export const PRISM_SHOT_INTERVAL = 0.16; // volley interval
export const PRISM_BULLET_SPEED = 14; // fast raiden-style bolts
export const PRISM_COLUMN_OFFSET = 0.35; // lateral offset of each column (cells)
export const PRISM_DMG_FRAC = 0.6; // per-bolt share so the twin columns don't double the beam's DPS
export const CHAIN_LIGHTNING_RANGE = 4;
export const CHAIN_LIGHTNING_FALLOFF = 0.6;

// boss off-screen direction indicator
export const BOSS_ARROW_FADE = 0.3; // seconds to fade the arrow when the boss enters view
export const BOSS_ARROW_COLORS: Record<number, string> = { 1: '#FF5365', 2: '#FF9A3D', 3: '#C43A52' };

// per-form attack damage multiplier indexed by morph stage (1..3)
export const ATTACK_FORM_MULT: Record<'red' | 'blue' | 'green', [number, number, number]> = {
  red: [1.6, 2.2, 3.0],
  blue: [1.2, 1.6, 2.2],
  green: [1.1, 1.4, 1.8],
};
export const PRISM_ATTACK_MULT = 3.5;

// multiplicative element/event attack amplification (total capped by ATTACK_CAP_MULT)
export const ELEMENT_ATTACK_AMP: Partial<Record<EffectKind, number>> = {
  fireAtk: 1.35,
  charged: 1.25,
  melt: 2.0,
  overload: 1.6,
  superconduct: 1.5,
  resonanceBoost: 1.5,
};
export const GOLDEN_TIME_ATTACK_MULT = 2.0;
export const OVERLOAD_SHIELD_COOLDOWN = 8; // seconds between overload-granted shields
export const SUPERCONDUCT_BOSS_SLOW = 0.3; // boss fire-rate reduction while superconduct active




export const COLORS = {
  bg: '#090E1A',
  board: '#111A2B',
  gridLine: '#1B2940',
  obstacle: '#0A1120',
  obstacleEdge: 'rgba(122,152,202,0.34)',
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
  // debuffs
  haste: 7,
  fog: 6,
  weak: 8,
  // element infusions (double as the reaction window)
  fireAtk: 7,
  iceArmor: 7,
  charged: 7,
  // fusion reactions
  melt: 5,
  overload: 5,
  superconduct: 6,
};

// score multiplier contributed by each active effect
export const EFFECT_SCORE_MULT: Partial<Record<EffectKind, number>> = {
  burn: 1.5,
  berserk: 1.8,
  flame: 2.5,
  alien: 1.4,
  resonanceBoost: 1.5,
  // elements & reactions
  fireAtk: 1.35,
  charged: 1.25,
  melt: 2.2,
  overload: 1.8,
  superconduct: 1.6,
  // debuff: weak halves gene-bean score
  weak: 0.5,
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
  haste: '失控加速',
  fog: '迷雾',
  weak: '虚弱',
  fireAtk: '焰蕴',
  iceArmor: '霜蕴',
  charged: '雷蕴',
  melt: '融化',
  overload: '超载',
  superconduct: '超导',
};

// effects that harm the player — rendered as red chips in the HUD
export const DEBUFF_EFFECTS: ReadonlySet<EffectKind> = new Set<EffectKind>(['haste', 'fog', 'weak']);

// per-effect accent color, shared by HUD tooltips and the persistent canvas auras
export const EFFECT_COLORS: Record<EffectKind, string> = {
  burn: '#FF7A45',
  berserk: '#FF5365',
  flame: '#FF7030',
  condense: '#7FE9FF',
  afterimage: '#9BE8FF',
  ghost: '#8FB8FF',
  proliferate: '#4EF1A3',
  metabolize: '#4EF1A3',
  regen: '#4EF1A3',
  alien: '#4EF1A3',
  magnet: '#B176FF',
  slow: '#43BFFF',
  resonanceBoost: '#FFC857',
  haste: '#FF7A45',
  fog: '#9AA6BD',
  weak: '#9B7BB5',
  fireAtk: '#FF8A3D',
  iceArmor: '#7FE9FF',
  charged: '#FFE066',
  melt: '#FFB37F',
  overload: '#FFD24A',
  superconduct: '#9BE8FF',
};

// tooltip copy for every timed effect
export const EFFECT_DESCS: Record<EffectKind, string> = {
  burn: '红 3 连触发：灼热基因沸腾，吃豆得分 ×1.5。',
  berserk: '红 4 连触发：移动速度大幅提升，吃豆得分 ×1.8，小心失控撞墙！',
  flame: '红 5 连进化：进入赤焰形态，蛇身燃烧，吃豆得分 ×2.5，每次吃豆附带烈焰反馈。',
  condense: '蓝 2 连触发：寒气凝滞，移动速度降低，更易精准走位。',
  afterimage: '蓝 4 连触发：移动速度降低并留下冰晶残影。',
  ghost: '蓝 5 连进化：进入幽体形态，蛇身半透明、移速略降，并获得 2 层相位护盾。',
  proliferate: '绿连锁触发：细胞快速增殖，本次吃豆额外成长。',
  metabolize: '绿 3 连触发：代谢蛇尾，缩短身体并换取分数。',
  regen: '绿 4 连触发：大幅再生代谢，缩短更多蛇尾并换取更高分数。',
  alien: '绿 5 连进化：进入异化形态，每吃一豆代谢 1 节蛇尾，得分 ×1.4，长度可控。',
  magnet: '技能·基因磁吸：持续自动吸收蛇头附近 4.5 格内的豆子。',
  slow: '技能·时间缓流：持续大幅降低移动速度，从容规划路线。',
  resonanceBoost: '达成极彩共鸣：三色基因全部完成 3 连，限时得分 ×1.5。',
  haste: '危险！失控加速：移动速度 ×1.4，极易撞墙，尽快撑到效果结束或吃净化豆。',
  fog: '危险！迷雾笼罩：视野大幅受限，只能看清蛇头附近区域。',
  weak: '危险！虚弱状态：基因豆得分减半。',
  fireAtk: '炎元素附著：吃豆得分 ×1.35。此时再吃另一种元素豆将触发融合反应。',
  iceArmor: '霜元素附著：移速降低、走位更稳。此时再吃另一种元素豆将触发融合反应。',
  charged: '雷元素附著：移速 ×1.12，得分 ×1.25。此时再吃另一种元素豆将触发融合反应。',
  melt: '炎+霜融合·融化：烈焰蒸腾，吃豆得分 ×2.2。',
  overload: '炎+雷融合·超载：电流狂暴，得分 ×1.8、移速提升，并额外获得 1 层护盾。',
  superconduct: '霜+雷融合·超导：电阻消失，移速大幅降低但得分 ×1.6。',
};

// tooltip copy for the gene-chain panel entry
export const CHAIN_HELP =
  '连续吞噬同色基因豆可提升连锁等级（最高 5 连），等级越高得分倍率越高（×1 → ×1.4 → ×1.8 → ×2.4 → ×3.2）。\n' +
  '红·狂热：2 连提速反馈，3 连灼烧，4 连暴走，5 连进化为赤焰形态。\n' +
  '蓝·幻影：2 连冷凝减速，3 连获得护盾，4 连残影，5 连进化为幽体形态。\n' +
  '绿·蜕变：2 连增殖成长，3 连代谢缩尾得分，4 连再生，5 连进化为异化形态。\n' +
  '切换颜色会重置连锁；彩虹豆可延续当前连锁。';

// ---- morph evolution: permanent within-run appearance tied to evolution direction ----
export interface MorphDef {
  name: string;
  palette: { primary: string; secondary: string; glow: string };
}

export const MORPH_DEFS: Record<GeneColor, MorphDef> = {
  red: { name: '炎狱兽', palette: { primary: '#FF5365', secondary: '#FF9A3D', glow: '#FF7030' } },
  blue: { name: '渊灵', palette: { primary: '#43BFFF', secondary: '#BFE6FF', glow: '#7FD4FF' } },
  green: { name: '共生体', palette: { primary: '#4EF1A3', secondary: '#B7FFDD', glow: '#3DDB8C' } },
};

export const MORPH_STAGE_NAMES = ['', '觉醒', '深变', '究极'];
export const MORPH_MAX_STAGE = 3;
export const PRISM_MORPH_NAME = '虹彩巨蛇';

export interface MorphSummary {
  name: string;
  stage: number;
  mixed: boolean;
  color: string;
  total: number;
  races: GeneColor[];
}

/** Resolve the visible morph (dominant race, mixed on ties, prism overrides). */
export function morphSummary(morph: MorphState): MorphSummary {
  const total = morph.tiers.red + morph.tiers.blue + morph.tiers.green;
  const stage = Math.min(MORPH_MAX_STAGE, total);
  if (morph.prism) {
    return { name: PRISM_MORPH_NAME, stage, mixed: false, color: '#B176FF', total, races: [] };
  }
  const all: GeneColor[] = ['red', 'blue', 'green'];
  const max = Math.max(morph.tiers.red, morph.tiers.blue, morph.tiers.green);
  if (max === 0) return { name: '', stage: 0, mixed: false, color: '#7C8DB5', total, races: [] };
  const races = all.filter((g) => morph.tiers[g] === max);
  const mixed = races.length > 1;
  return {
    name: races.map((g) => MORPH_DEFS[g].name).join('·'),
    stage,
    mixed,
    color: MORPH_DEFS[races[0]].palette.glow,
    total,
    races,
  };
}

export const MORPH_HELP =
  '每次完成 5 连进化，形态阶段永久 +1（觉醒 → 深变 → 究极），蛇的头部、身体与尾部逐渐长出对应种族的特征。\n' +
  '红系「炎狱兽」：头角、裂纹光纹、焰状尾。\n' +
  '蓝系「渊灵」：流线吻部、幻影环、流光尾。\n' +
  '绿系「共生体」：触须、孢囊、卷须尾。\n' +
  '多系同级时特征混合显示；达成极彩共鸣解锁隐藏形态「虹彩巨蛇」。';

// ---- speed tuning for new effects ----
export const HASTE_SPEED_MULT = 1.4;
export const CHARGED_SPEED_MULT = 1.12;
export const OVERLOAD_SPEED_MULT = 1.22;
export const SUPERCONDUCT_SLOW_FACTOR = 0.42;

// ---- beans ----
export const SKILL_MAX_CHARGES_BASE = 3;
export const SKILL_BEAN_CHANCE = 0.16; // per maintenance pass when no skill bean on board
export const RAINBOW_CHANCE = 0.08;
export const CLONE_CHANCE = 0.05;
export const CROWN_CHANCE = 0.028;
export const CROWN_COOLDOWN = 45; // seconds between crowns
export const GENE_BEAN_TARGET = 5; // gene beans kept near the head (excl. per-color minimums)
export const GENE_STORM_EXTRA = 3;

// ---- local spawning on the large map (all distances in cells) ----
export const SPAWN_RADIUS = 12; // maintain/spawn beans within this distance of the head
export const CULL_RADIUS = 22; // despawn beans farther than this from the head
export const MIN_SPAWN_DIST = 3; // avoid spawning beans right under the head
export const MAINTAIN_DIST = 5; // re-run bean maintenance after the head travels this far

// ---- debuff / buff beans ----
export const HASTE_CHANCE = 0.05;
export const FOG_CHANCE = 0.045;
export const WEAK_CHANCE = 0.045;
export const CORRUPT_CHANCE = 0.05;
export const SHIELD_CHANCE = 0.03;
export const PURIFY_CHANCE = 0.022;
export const CORRUPT_SCORE_FRACTION = 0.08; // corrupt bean removes this fraction of score
export const CORRUPT_MIN = 20; // ...at least this much (when score allows)
export const PURIFY_SCORE_BONUS = 40;

// ---- element beans & fusion reactions ----
export const ELEMENT_BEAN_TARGET = 2;
export const ELEMENT_LIST: ElementKind[] = ['fire', 'ice', 'lightning'];
export const ELEMENT_NAMES: Record<ElementKind, string> = {
  fire: '炎',
  ice: '霜',
  lightning: '雷',
};
export const ELEMENT_COLORS: Record<ElementKind, string> = {
  fire: '#FF8A3D',
  ice: '#7FE9FF',
  lightning: '#FFE066',
};
// infusion effect granted by each element when eaten alone
export const ELEMENT_EFFECT: Record<ElementKind, EffectKind> = {
  fire: 'fireAtk',
  ice: 'iceArmor',
  lightning: 'charged',
};
export const ELEMENT_STACK_BONUS = 30; // score for re-eating the same element (enhance)

export interface ReactionDef {
  effect: EffectKind;
  name: string;
  color: string;
  bonus: number;
  shield?: number;
}
// keyed by the two elements joined in alphabetical order
export const REACTIONS: Record<string, ReactionDef> = {
  'fire+ice': { effect: 'melt', name: '融化', color: '#FFB37F', bonus: 260 },
  'fire+lightning': { effect: 'overload', name: '超载', color: '#FFD24A', bonus: 240, shield: 1 },
  'ice+lightning': { effect: 'superconduct', name: '超导', color: '#9BE8FF', bonus: 220 },
};

// visual colors for the new bean kinds
export const BEAN_COLORS: Record<DebuffKind | BuffKind | ElementKind, string> = {
  haste: '#FF7A45',
  fog: '#9AA6BD',
  weak: '#9B7BB5',
  corrupt: '#C43A52',
  shield: '#43BFFF',
  purify: '#B7FFDD',
  fire: '#FF8A3D',
  ice: '#7FE9FF',
  lightning: '#FFE066',
};

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
export const BERSERK_SPEED_BONUS = 0.88;
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
