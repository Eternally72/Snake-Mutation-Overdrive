export interface Vec {
  x: number;
  y: number;
}

export type GeneColor = 'red' | 'blue' | 'green';

export type ElementKind = 'fire' | 'ice' | 'lightning';

export type DebuffKind = 'haste' | 'fog' | 'weak' | 'corrupt';

export type BuffKind = 'shield' | 'purify';

export type BeanKind =
  | GeneColor
  | 'skill'
  | 'rainbow'
  | 'clone'
  | 'crown'
  | ElementKind
  | DebuffKind
  | BuffKind;

export interface Bean {
  id: number;
  kind: BeanKind;
  pos: Vec;
  born: number;
}

export type SkillKind = 'dash' | 'magnet' | 'slow' | 'shed';

export type EffectKind =
  | 'burn'
  | 'berserk'
  | 'flame'
  | 'condense'
  | 'afterimage'
  | 'ghost'
  | 'proliferate'
  | 'metabolize'
  | 'regen'
  | 'alien'
  | 'magnet'
  | 'slow'
  | 'resonanceBoost'
  // debuffs
  | 'haste'
  | 'fog'
  | 'weak'
  // element infusions (single element buff, also acts as reaction window)
  | 'fireAtk'
  | 'iceArmor'
  | 'charged'
  // element fusion reactions
  | 'melt'
  | 'overload'
  | 'superconduct';

export interface TimedEffect {
  kind: EffectKind;
  remaining: number;
  duration: number;
}

export type EventKind = 'geneStorm' | 'goldenTime' | 'rainbowTide';

export interface GameEvent {
  kind: EventKind;
  remaining: number;
  duration: number;
}

export type UpgradeId =
  | 'redAmp'
  | 'flameCore'
  | 'extremeFever'
  | 'coldCore'
  | 'phaseArmor'
  | 'ghostExtend'
  | 'wildGrowth'
  | 'efficientMetabolism'
  | 'shedExpert'
  | 'chainAmp'
  | 'geneMemory'
  | 'rainbowResonance'
  | 'goldenGluttony'
  | 'skillCharge'
  | 'secondLife';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  school: 'red' | 'blue' | 'green' | 'chain' | 'general';
  maxLevel: number;
}

export type GamePhase = 'playing' | 'paused' | 'upgrade' | 'dead' | 'victory';

export type FxType =
  | 'eat'
  | 'chain'
  | 'evolve'
  | 'skill'
  | 'dash'
  | 'magnet'
  | 'slow'
  | 'shed'
  | 'shieldBreak'
  | 'death'
  | 'upgrade'
  | 'eventStart'
  | 'eventEnd'
  | 'deny'
  | 'crown'
  | 'secondLife'
  | 'buff'
  | 'debuff'
  | 'reaction'
  // combat
  | 'bossSpawn'
  | 'bossShoot'
  | 'bossHit'
  | 'bossDeath'
  | 'playerShoot'
  | 'playerHit'
  | 'minionSpawn'
  | 'minionDeath';

export interface FxEvent {
  type: FxType;
  pos?: Vec;
  color?: string;
  count?: number;
  text?: string;
  gene?: GeneColor;
  skill?: SkillKind;
  event?: EventKind;
  big?: boolean;
}

export interface ChainState {
  color: GeneColor | null;
  count: number;
}

/** Permanent within-run appearance evolution, driven by 5-chain evolutions. */
export interface MorphState {
  tiers: Record<GeneColor, number>;
  prism: boolean;
}

export interface SkillState {
  kind: SkillKind;
  charges: number;
}

// ---------- combat (boss / bullets / minions / player attack) ----------
export type BossPhase = 1 | 2 | 3;

/** An axis-aligned rubble slab in cell coordinates; lethal to the snake head, blocks bullets. */
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A wandering boss that keeps its distance while firing projectiles at the snake head. */
export interface BossState {
  id: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** Score at spawn time; all combat numbers anchor to this to avoid a death spiral. */
  anchorScore: number;
  phase: BossPhase;
  /** Seconds of warning telegraph remaining before the boss becomes active. */
  telegraph: number;
  fireCooldown: number;
  aimedCooldown: number;
  specialCooldown: number;
  summonCooldown: number;
  /** Current wander anchor on the engagement ring; null → re-pick next tick. */
  moveTarget: Vec | null;
  retargetTimer: number;
  /** Body-contact damage cooldown. */
  hitCooldown: number;
  /** Freeze-slow remaining (blue bolts): reduced move & fire rate while > 0. */
  slowTimer: number;
}

export interface BulletState {
  id: number;
  pos: Vec;
  vel: Vec;
  /** Score damage dealt to the snake head. */
  dmg: number;
  radius: number;
  color: string;
  /** Purple phase-3 bullet that also applies the `weak` debuff. */
  special: boolean;
  /** Muzzle-flash telegraph remaining; the bullet is frozen until it reaches 0. */
  muzzle: number;
  life: number;
}

/** A ramming minion; boss-summoned or ambient. Ambient ones drop a gene bean on death. */
export interface MinionState {
  id: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  anchorScore: number;
  hitCooldown: number;
  ambient: boolean;
  /** Freeze-slow remaining (blue bolts). */
  slowTimer: number;
  /** Poison DoT (green bolts): refreshable, capped stacks. */
  poisonStacks: number;
  poisonTimer: number;
}

/** Player-fired projectile; homing shots stay locked on `targetId` until it dies. */
export interface PlayerShot {
  id: number;
  pos: Vec;
  vel: Vec;
  dmg: number;
  radius: number;
  color: string;
  homing: boolean;
  /** Locked enemy id (boss or minion) chosen at fire time; null → straight flight. */
  targetId: number | null;
  /** On-hit rider: blue bolts freeze-slow, green bolts stack poison. */
  effect: 'none' | 'slow' | 'poison';
  life: number;
}

/** Which morph attack the snake is currently using. */
export type AttackForm = 'none' | 'red' | 'blue' | 'green' | 'prism';

export interface RunStats {
  score: number;
  maxChain: number;
  maxLength: number;
  evolutions: number;
  timeAlive: number;
  bossesKilled: number;
  upgrades: { id: UpgradeId; level: number }[];
}

export interface HudState {
  phase: GamePhase;
  score: number;
  chain: ChainState;
  snakeLength: number;
  skill: SkillState | null;
  shields: number;
  effects: TimedEffect[];
  activeEvent: GameEvent | null;
  upgrades: { id: UpgradeId; level: number }[];
  upgradeChoices: UpgradeId[];
  stats: RunStats;
  clonePending: boolean;
  secondLifeUsed: boolean;
  hasSecondLife: boolean;
  morph: MorphState;
  /** Active boss summary for the HUD (null when none). */
  boss: { hp: number; maxHp: number; phase: BossPhase; anchorScore: number } | null;
  /** Score needed to trigger the next (not-yet-consumed) boss threshold. */
  nextBossAt: number;
  /** Current attack form derived from the active morph (for the HUD hint). */
  attackForm: AttackForm;
}
