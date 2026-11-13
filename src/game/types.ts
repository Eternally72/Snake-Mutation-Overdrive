export interface Vec {
  x: number;
  y: number;
}

export type GeneColor = 'red' | 'blue' | 'green';

export type BeanKind = GeneColor | 'skill' | 'rainbow' | 'clone' | 'crown';

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
  | 'resonanceBoost';

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
  | 'secondLife';

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

export interface SkillState {
  kind: SkillKind;
  charges: number;
}

export interface RunStats {
  score: number;
  maxChain: number;
  maxLength: number;
  evolutions: number;
  timeAlive: number;
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
}
