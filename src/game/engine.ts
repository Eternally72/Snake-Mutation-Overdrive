import {
  BASE_BEAN_SCORE,
  BASE_SPEED,
  BERSERK_SPEED_BONUS,
  CHAIN_MULT,
  COLD_CORE_SLOW_FACTOR,
  CROWN_CHANCE,
  CROWN_COOLDOWN,
  CLONE_CHANCE,
  DASH_DISTANCE,
  EFFECT_DURATION,
  EFFECT_SCORE_MULT,
  EVENT_DEFS,
  EVENT_FIRST_DELAY,
  EVENT_GAP_MAX,
  EVENT_GAP_MIN,
  GENE_BEAN_TARGET,
  GENE_STORM_EXTRA,
  GOLDEN_TIME_MULT,
  GRID,
  MAGNET_RADIUS,
  MAX_CHAIN,
  MAX_SPEED,
  MAX_TOTAL_MULTIPLIER,
  MIN_SNAKE_LENGTH,
  RAINBOW_CHANCE,
  RAINBOW_TIDE_MULT,
  SHED_FRACTION,
  SHED_SCORE_PER_SEGMENT,
  SHIELD_CAP_BASE,
  SKILL_BEAN_CHANCE,
  SKILL_MAX_CHARGES_BASE,
  SLOW_FACTOR,
  SPEED_SCORE_RAMP,
  upgradeThreshold,
} from './config';
import { mulberry32, randomSeed } from './rng';
import type {
  Bean,
  BeanKind,
  ChainState,
  EventKind,
  FxEvent,
  GameEvent,
  GamePhase,
  GeneColor,
  HudState,
  RunStats,
  SkillKind,
  SkillState,
  TimedEffect,
  UpgradeId,
  Vec,
} from './types';

export interface SnakeSegment extends Vec {
  color: GeneColor;
}

const DIRS: Record<string, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const GENE_LIST: GeneColor[] = ['red', 'blue', 'green'];
const SKILL_LIST: SkillKind[] = ['dash', 'magnet', 'slow', 'shed'];

export class GameEngine {
  phase: GamePhase = 'playing';
  snake: SnakeSegment[] = [];
  prevSnake: Vec[] = [];
  dir = 'right';
  private dirQueue: string[] = [];
  private growth = 0;
  private lastEatenColor: GeneColor = 'green';

  beans: Bean[] = [];
  private beanId = 1;

  score = 0;
  chain: ChainState = { color: null, count: 0 };
  effects: TimedEffect[] = [];
  shields = 0;
  skill: SkillState | null = null;
  clonePending = false;
  upgrades: Map<UpgradeId, number> = new Map();

  activeEvent: GameEvent | null = null;
  private nextEventIn = EVENT_FIRST_DELAY;
  private lastCrownAt = -CROWN_COOLDOWN;
  private elapsed = 0;

  private nextUpgradeIndex = 0;
  upgradeChoices: UpgradeId[] = [];

  fxQueue: FxEvent[] = [];
  private rng: () => number;
  private geneMemoryUsed = false;
  private threeChains: Set<GeneColor> = new Set();
  private resonanceDone = false;
  secondLifeUsed = false;

  stats = {
    maxChain: 0,
    maxLength: 0,
    evolutions: 0,
    totalEaten: 0,
  };

  constructor(seed?: number) {
    this.rng = mulberry32(seed ?? randomSeed());
    this.reset(seed);
  }

  reset(seed?: number) {
    if (seed !== undefined) this.rng = mulberry32(seed);
    this.phase = 'playing';
    this.snake = [
      { x: 8, y: 10, color: 'green' },
      { x: 7, y: 10, color: 'green' },
      { x: 6, y: 10, color: 'green' },
    ];
    this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
    this.dir = 'right';
    this.dirQueue = [];
    this.growth = 0;
    this.lastEatenColor = 'green';
    this.beans = [];
    this.beanId = 1;
    this.score = 0;
    this.chain = { color: null, count: 0 };
    this.effects = [];
    this.shields = 0;
    this.skill = null;
    this.clonePending = false;
    this.upgrades = new Map();
    this.activeEvent = null;
    this.nextEventIn = EVENT_FIRST_DELAY;
    this.lastCrownAt = -CROWN_COOLDOWN;
    this.elapsed = 0;
    this.nextUpgradeIndex = 0;
    this.upgradeChoices = [];
    this.fxQueue = [];
    this.geneMemoryUsed = false;
    this.threeChains = new Set();
    this.resonanceDone = false;
    this.secondLifeUsed = false;
    this.stats = { maxChain: 0, maxLength: 0, evolutions: 0, totalEaten: 0 };
    this.spawnInitialBeans();
  }

  // ---------- helpers ----------
  private fx(e: FxEvent) {
    this.fxQueue.push(e);
    if (this.fxQueue.length > 60) this.fxQueue.shift();
  }

  drainFx(): FxEvent[] {
    const q = this.fxQueue;
    this.fxQueue = [];
    return q;
  }

  upgradeLevel(id: UpgradeId): number {
    return this.upgrades.get(id) ?? 0;
  }

  private inBounds(p: Vec): boolean {
    return p.x >= 0 && p.x < GRID && p.y >= 0 && p.y < GRID;
  }

  private beanAt(p: Vec): Bean | undefined {
    return this.beans.find((b) => b.pos.x === p.x && b.pos.y === p.y);
  }

  private isFreeCell(p: Vec, ignoreBeanIds = new Set<number>()): boolean {
    if (!this.inBounds(p)) return false;
    if (this.snake.some((s) => s.x === p.x && s.y === p.y)) return false;
    if (this.beans.some((b) => !ignoreBeanIds.has(b.id) && b.pos.x === p.x && b.pos.y === p.y)) return false;
    return true;
  }

  private freeCells(): Vec[] {
    const cells: Vec[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (this.isFreeCell({ x, y })) cells.push({ x, y });
      }
    }
    return cells;
  }

  /** Free cells reachable from the snake head through free space (avoids trapping beans). */
  private reachableFreeCells(): Vec[] {
    const free = new Set<number>();
    for (const c of this.freeCells()) free.add(c.y * GRID + c.x);
    const head = this.snake[0];
    const start = head.y * GRID + head.x;
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const cx = cur % GRID;
      const cy = (cur - cx) / GRID;
      for (const d of Object.values(DIRS)) {
        const nx = cx + d.x;
        const ny = cy + d.y;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        const key = ny * GRID + nx;
        if (seen.has(key)) continue;
        seen.add(key);
        if (free.has(key)) queue.push(key);
      }
    }
    return [...free].filter((k) => seen.has(k)).map((k) => ({ x: k % GRID, y: Math.floor(k / GRID) }));
  }

  private pickSpawnCell(): Vec | null {
    const reachable = this.reachableFreeCells();
    if (reachable.length > 0) {
      return reachable[Math.floor(this.rng() * reachable.length)];
    }
    const free = this.freeCells();
    if (free.length > 0) return free[Math.floor(this.rng() * free.length)];
    return null;
  }

  private spawnBean(kind: BeanKind): Bean | null {
    const pos = this.pickSpawnCell();
    if (!pos) return null;
    const bean: Bean = { id: this.beanId++, kind, pos, born: this.elapsed };
    this.beans.push(bean);
    return bean;
  }

  // ---------- beans ----------
  private spawnInitialBeans() {
    for (const g of GENE_LIST) this.spawnBean(g);
    this.spawnBean(GENE_LIST[Math.floor(this.rng() * 3)]);
  }

  private maintainBeans() {
    // keep at least one of each gene color
    for (const g of GENE_LIST) {
      if (!this.beans.some((b) => b.kind === g)) this.spawnBean(g);
    }
    // keep gene bean population at target
    const geneCount = this.beans.filter((b) => b.kind === 'red' || b.kind === 'blue' || b.kind === 'green').length;
    const target = GENE_BEAN_TARGET + (this.activeEvent?.kind === 'geneStorm' ? GENE_STORM_EXTRA : 0);
    for (let i = geneCount; i < target; i++) {
      this.spawnBean(GENE_LIST[Math.floor(this.rng() * 3)]);
    }
    // rare special beans
    if (!this.beans.some((b) => b.kind === 'rainbow')) {
      const chance = RAINBOW_CHANCE * (this.activeEvent?.kind === 'rainbowTide' ? RAINBOW_TIDE_MULT : 1);
      if (this.rng() < chance) this.spawnBean('rainbow');
    }
    if (!this.beans.some((b) => b.kind === 'clone') && this.rng() < CLONE_CHANCE) {
      this.spawnBean('clone');
    }
    if (
      !this.beans.some((b) => b.kind === 'crown') &&
      this.elapsed - this.lastCrownAt > CROWN_COOLDOWN &&
      this.rng() < CROWN_CHANCE
    ) {
      if (this.spawnBean('crown')) {
        this.lastCrownAt = this.elapsed;
        this.fx({ type: 'crown' });
      }
    }
    // skill bean
    if (!this.beans.some((b) => b.kind === 'skill') && this.rng() < SKILL_BEAN_CHANCE) {
      this.spawnBean('skill');
    }
  }

  // ---------- speed ----------
  speed(): number {
    let s = BASE_SPEED;
    s += Math.min(MAX_SPEED - BASE_SPEED, (this.score / SPEED_SCORE_RAMP) * (MAX_SPEED - BASE_SPEED));
    if (this.hasEffect('berserk')) s += BERSERK_SPEED_BONUS;
    if (this.upgradeLevel('extremeFever') > 0 && this.chain.color === 'red' && this.chain.count >= MAX_CHAIN) s += 0.8;
    if (this.hasEffect('slow') || this.hasEffect('condense') || this.hasEffect('afterimage')) {
      s *= this.upgradeLevel('coldCore') > 0 ? COLD_CORE_SLOW_FACTOR : SLOW_FACTOR;
    }
    if (this.hasEffect('ghost')) s *= 0.85;
    return Math.max(3, Math.min(MAX_SPEED + 3, s));
  }

  hasEffect(kind: TimedEffect['kind']): boolean {
    return this.effects.some((e) => e.kind === kind);
  }

  /** 0..1 progress between the last grid step and the next, for smooth rendering. */
  stepProgress(): number {
    if (this.phase !== 'playing') return 1;
    return Math.max(0, Math.min(1, this.accumulator * this.speed()));
  }

  private addEffect(kind: TimedEffect['kind'], durationBonus = 0) {
    const duration = EFFECT_DURATION[kind] + durationBonus;
    const existing = this.effects.find((e) => e.kind === kind);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.effects.push({ kind, remaining: duration, duration });
    }
  }

  private shieldCap(): number {
    return SHIELD_CAP_BASE + this.upgradeLevel('phaseArmor') * 2;
  }

  private addShields(n: number) {
    this.shields = Math.min(this.shieldCap(), this.shields + n);
  }

  skillMaxCharges(): number {
    return SKILL_MAX_CHARGES_BASE + this.upgradeLevel('skillCharge') * 2;
  }

  // ---------- input ----------
  enqueueDir(dir: string) {
    if (!DIRS[dir]) return;
    const last = this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    if (this.dirQueue.length < 2) this.dirQueue.push(dir);
  }

  pause() {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume() {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  togglePause() {
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
  }

  // ---------- main update ----------
  update(dt: number) {
    if (this.phase !== 'playing') return;
    this.elapsed += dt;
    this.tickEffects(dt);
    this.tickEvent(dt);

    const step = 1 / this.speed();
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= step && steps < 4 && this.phase === 'playing') {
      this.accumulator -= step;
      this.stepOnce();
      steps++;
    }
    if (this.accumulator > step * 4) this.accumulator = 0;
  }

  private accumulator = 0;

  private tickEffects(dt: number) {
    for (const e of this.effects) e.remaining -= dt;
    const expired = this.effects.filter((e) => e.remaining <= 0);
    if (expired.length) this.effects = this.effects.filter((e) => e.remaining > 0);
    // magnet pulls beans toward head each tick
    if (this.hasEffect('magnet')) this.magnetTick(dt);
  }

  private magnetAccum = 0;
  private magnetTick(dt: number) {
    this.magnetAccum += dt;
    const interval = 0.18;
    while (this.magnetAccum >= interval) {
      this.magnetAccum -= interval;
      const head = this.snake[0];
      for (const bean of [...this.beans]) {
        const dx = head.x - bean.pos.x;
        const dy = head.y - bean.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > MAGNET_RADIUS) continue;
        if (dist <= 0.6) {
          this.eatBean(bean);
          continue;
        }
        const sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
        const sy = sx === 0 ? Math.sign(dy) : Math.abs(dy) > Math.abs(dx) * 1.2 ? Math.sign(dy) : 0;
        const np = { x: bean.pos.x + sx, y: bean.pos.y + sy };
        if (!this.snake.some((s) => s.x === np.x && s.y === np.y) && !this.beanAt(np)) {
          bean.pos = np;
        }
      }
    }
  }

  private tickEvent(dt: number) {
    if (this.activeEvent) {
      this.activeEvent.remaining -= dt;
      if (this.activeEvent.remaining <= 0) {
        this.fx({ type: 'eventEnd', event: this.activeEvent.kind });
        this.activeEvent = null;
        this.nextEventIn = EVENT_GAP_MIN + this.rng() * (EVENT_GAP_MAX - EVENT_GAP_MIN);
        // remove storm surplus beans
        this.trimBeansAfterEvent();
      }
    } else {
      this.nextEventIn -= dt;
      if (this.nextEventIn <= 0) this.startRandomEvent();
    }
  }

  private trimBeansAfterEvent() {
    const genes = this.beans.filter((b) => b.kind === 'red' || b.kind === 'blue' || b.kind === 'green');
    const surplus = genes.length - GENE_BEAN_TARGET;
    if (surplus > 0) {
      const removed = genes.slice(0, surplus);
      this.beans = this.beans.filter((b) => !removed.includes(b));
    }
  }

  private startRandomEvent() {
    const kinds: EventKind[] = ['geneStorm', 'goldenTime', 'rainbowTide'];
    const kind = kinds[Math.floor(this.rng() * kinds.length)];
    const def = EVENT_DEFS[kind];
    this.activeEvent = { kind, remaining: def.duration, duration: def.duration };
    this.fx({ type: 'eventStart', event: kind, text: def.name });
    if (kind === 'geneStorm') this.maintainBeans();
  }

  // ---------- step ----------
  private stunLock = false;

  private isSafeMove(d: Vec): boolean {
    const head = this.snake[0];
    const np = { x: head.x + d.x, y: head.y + d.y };
    if (!this.inBounds(np)) return false;
    const tailMoves = this.growth === 0;
    for (let i = 0; i < this.snake.length; i++) {
      if (tailMoves && i === this.snake.length - 1) continue;
      if (this.snake[i].x === np.x && this.snake[i].y === np.y) return false;
    }
    return true;
  }

  private applyQueuedDir() {
    if (this.dirQueue.length > 0) {
      const next = this.dirQueue.shift()!;
      if (next !== OPPOSITE[this.dir]) this.dir = next;
    }
  }

  private stepOnce() {
    if (this.stunLock) {
      this.applyQueuedDir();
      if (this.isSafeMove(DIRS[this.dir])) {
        this.stunLock = false;
      } else {
        // if no perpendicular escape exists either, the snake is truly trapped
        const alts = Object.keys(DIRS).filter((k) => k !== this.dir && k !== OPPOSITE[this.dir]);
        if (!alts.some((k) => this.isSafeMove(DIRS[k]))) {
          this.die('stuck');
          return;
        }
        return; // stay frozen until the player steers to safety
      }
    }
    this.applyQueuedDir();
    const d = DIRS[this.dir];
    const head = this.snake[0];
    const newPos = { x: head.x + d.x, y: head.y + d.y };

    // wall collision
    if (!this.inBounds(newPos)) {
      this.handleFatal('wall');
      return;
    }

    // self collision — tail cell vacates this step unless growing
    const tailMoves = this.growth === 0;
    let hitIndex = -1;
    for (let i = 0; i < this.snake.length; i++) {
      if (tailMoves && i === this.snake.length - 1) continue;
      if (this.snake[i].x === newPos.x && this.snake[i].y === newPos.y) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex >= 0) {
      if (this.shields > 0) {
        this.shields--;
        // truncate body from the hit point; head takes the cell
        const kept = this.snake.slice(0, hitIndex);
        this.snake = [{ ...newPos, color: this.lastEatenColor }, ...kept];
        this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
        this.growth = 0;
        this.fx({ type: 'shieldBreak', pos: newPos, color: '#43BFFF', count: 26 });
        return;
      }
      this.handleFatal('self');
      return;
    }

    this.advance(newPos);
  }

  private advance(newPos: Vec) {
    this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
    this.snake.unshift({ x: newPos.x, y: newPos.y, color: this.lastEatenColor });
    if (this.growth > 0) {
      this.growth--;
    } else {
      this.snake.pop();
    }
    this.stats.maxLength = Math.max(this.stats.maxLength, this.snake.length);
    const bean = this.beanAt(newPos);
    if (bean) this.eatBean(bean);
    if (this.snake.length >= GRID * GRID) {
      this.phase = 'victory';
      this.fx({ type: 'evolve', big: true });
    }
  }

  private handleFatal(cause: 'wall' | 'self') {
    if (!this.secondLifeUsed && this.upgradeLevel('secondLife') > 0) {
      this.secondLifeUsed = true;
      // freeze in place: skip this move entirely; player must steer away
      this.dirQueue = [];
      this.accumulator = 0;
      this.stunLock = true;
      this.fx({ type: 'secondLife', pos: this.snake[0], color: '#FFC857', count: 40, text: cause });
      return;
    }
    this.die(cause);
  }

  private die(cause: string) {
    this.phase = 'dead';
    this.stunLock = false;
    this.fx({ type: 'death', pos: this.snake[0], count: cause === 'wall' ? 50 : 40 });
  }

  // ---------- eating ----------
  private eatBean(bean: Bean) {
    this.beans = this.beans.filter((b) => b.id !== bean.id);
    this.stats.totalEaten++;
    switch (bean.kind) {
      case 'red':
      case 'blue':
      case 'green':
        this.eatGene(bean.kind, bean.pos);
        break;
      case 'rainbow': {
        const color = this.chain.color ?? GENE_LIST[Math.floor(this.rng() * 3)];
        this.eatGene(color, bean.pos);
        break;
      }
      case 'skill':
        this.grantSkill(bean.pos);
        this.maintainBeans();
        break;
      case 'clone':
        this.clonePending = true;
        this.fx({ type: 'eat', pos: bean.pos, color: '#B176FF', count: 10 });
        this.maintainBeans();
        break;
      case 'crown':
        this.fx({ type: 'crown', pos: bean.pos });
        this.triggerUpgradeChoice();
        this.maintainBeans();
        break;
    }
  }

  private eatGene(color: GeneColor, pos: Vec) {
    this.lastEatenColor = color;
    // chain update
    if (this.chain.color === color) {
      this.chain.count = Math.min(MAX_CHAIN, this.chain.count + 1);
    } else {
      let carry = 0;
      if (
        this.upgradeLevel('geneMemory') > 0 &&
        !this.geneMemoryUsed &&
        this.chain.color !== null &&
        this.chain.count >= 2
      ) {
        this.geneMemoryUsed = true;
        carry = Math.floor(this.chain.count / 2);
      }
      this.chain = { color, count: 1 + carry };
      if (this.chain.count > MAX_CHAIN) this.chain.count = MAX_CHAIN;
    }
    this.stats.maxChain = Math.max(this.stats.maxChain, this.chain.count);

    // growth
    this.growth += 1;
    if (color === 'green' && this.chain.count >= 2) this.growth += 1; // proliferate bonus
    if (this.upgradeLevel('wildGrowth') > 0 && color === 'green') {
      this.growth += this.upgradeLevel('wildGrowth');
    }
    if (this.hasEffect('alien')) {
      this.trimTail(1, 0);
    }

    // score
    const { total: gained, mult } = this.computeGeneScore(color);
    this.addScore(gained, pos, color, false, mult);

    // chain effects
    this.applyChainEffects(color, pos);

    if (this.clonePending) {
      this.clonePending = false;
      this.addScore(gained, pos, color, true);
    }

    // milestone check
    this.checkUpgradeMilestone();
    this.maintainBeans();
  }

  private computeGeneScore(color: GeneColor): { total: number; mult: number } {
    let base = BASE_BEAN_SCORE + this.upgradeLevel('goldenGluttony') * 5;
    if (this.upgradeLevel('wildGrowth') > 0 && color === 'green') base *= 1.2;

    let mult = 1;
    // chain multiplier
    const chainIdx = Math.min(MAX_CHAIN, this.chain.count) - 1;
    let cm = CHAIN_MULT[chainIdx];
    cm *= 1 + this.upgradeLevel('chainAmp') * 0.15;
    mult *= cm;
    // red school amp
    if (color === 'red') mult *= 1 + this.upgradeLevel('redAmp') * 0.5;
    // active timed effects
    for (const e of this.effects) {
      const m = EFFECT_SCORE_MULT[e.kind];
      if (m) {
        let mm = m;
        if (e.kind === 'flame' && this.upgradeLevel('extremeFever') > 0) mm *= 1.5;
        mult *= mm;
      }
    }
    // golden time event
    if (this.activeEvent?.kind === 'goldenTime') mult *= GOLDEN_TIME_MULT;

    mult = Math.max(0, Math.min(MAX_TOTAL_MULTIPLIER, mult));
    if (!Number.isFinite(mult)) mult = 1;
    const total = Math.round(base * mult);
    return { total: Number.isFinite(total) && total >= 0 ? total : 0, mult };
  }

  private addScore(amount: number, pos: Vec, color?: GeneColor | string, silent = false, mult = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.score += Math.round(amount);
    if (!silent) {
      const multText = mult >= 2 ? ` ×${mult.toFixed(1)}` : '';
      this.fx({
        type: this.chain.count >= 3 ? 'chain' : 'eat',
        pos,
        color: typeof color === 'string' ? color : undefined,
        count: Math.min(14, 6 + this.chain.count * 2),
        text: `+${Math.round(amount)}${multText}`,
        big: amount >= 100,
      });
    } else {
      this.fx({ type: 'eat', pos, color: '#B176FF', count: 8, text: `复制 +${Math.round(amount)}` });
    }
  }

  private applyChainEffects(color: GeneColor, pos: Vec) {
    const count = this.chain.count;
    if (count >= 3) this.threeChains.add(color);

    if (count === 2) {
      if (color === 'blue') {
        this.addEffect('condense', this.upgradeLevel('coldCore') > 0 ? 1 : 0);
      }
      this.fx({ type: 'chain', pos, count: 10, text: `2 连 · ${this.chainName(color, 2)}`, gene: color });
    } else if (count === 3) {
      if (color === 'red') this.addEffect('burn');
      if (color === 'blue') this.addShields(1 + (this.upgradeLevel('phaseArmor') > 0 ? 1 : 0));
      if (color === 'green') {
        const pts = this.trimTail(2, 30);
        if (pts > 0) this.fx({ type: 'chain', pos, gene: color, text: `代谢 +${pts}`, count: 12 });
      }
      this.fx({ type: 'chain', pos, count: 18, text: `3 连 · ${this.chainName(color, 3)}`, gene: color });
      this.checkResonance();
    } else if (count === 4) {
      if (color === 'red') this.addEffect('berserk');
      if (color === 'blue') {
        this.addEffect('afterimage', this.upgradeLevel('coldCore') > 0 ? 1.5 : 0);
        this.addShields(1);
      }
      if (color === 'green') {
        const pts = this.trimTail(3, 50);
        if (pts > 0) this.fx({ type: 'chain', pos, gene: color, text: `再生 +${pts}`, count: 14 });
      }
      this.fx({ type: 'chain', pos, count: 24, text: `4 连 · ${this.chainName(color, 4)}`, gene: color });
    } else if (count === 5) {
      this.stats.evolutions++;
      if (color === 'red') this.addEffect('flame');
      if (color === 'blue') {
        this.addEffect('ghost', this.upgradeLevel('ghostExtend') > 0 ? 4 * this.upgradeLevel('ghostExtend') : 0);
        this.addShields(2);
      }
      if (color === 'green') this.addEffect('alien');
      this.fx({
        type: 'evolve',
        pos,
        gene: color,
        count: 40,
        text: this.chainName(color, 5),
        big: true,
      });
    }
    // flame form: extra feedback per eat
    if (this.hasEffect('flame') && color === 'red' && count < 5) {
      this.fx({ type: 'chain', pos, gene: 'red', count: 10 });
    }
  }

  private chainName(color: GeneColor, count: number): string {
    const names: Record<GeneColor, string[]> = {
      red: ['', '火花', '灼烧', '暴走', '赤焰形态'],
      blue: ['', '冷凝', '相位蓄能', '残影', '幽体形态'],
      green: ['', '增殖', '代谢', '再生', '异化形态'],
    };
    return names[color][count - 1] ?? '';
  }

  /** Removes n tail segments (respecting min length), returns score awarded. */
  trimTail(n: number, baseScore: number): number {
    const cut = Math.min(n, Math.max(0, this.snake.length - MIN_SNAKE_LENGTH));
    if (cut <= 0) return 0;
    const removed = this.snake.splice(this.snake.length - cut, cut);
    this.growth = Math.max(0, this.growth - cut);
    let pts = baseScore * cut;
    pts *= 1 + this.upgradeLevel('efficientMetabolism') * 1.0;
    if (this.upgradeLevel('shedExpert') > 0) pts *= 2;
    pts = Math.round(pts);
    if (pts > 0 && baseScore > 0) this.score += pts;
    if (removed.length > 0) {
      this.fx({
        type: 'shed',
        pos: removed[0],
        color: '#4EF1A3',
        count: Math.min(30, removed.length * 6),
      });
    }
    return pts;
  }

  private checkResonance() {
    if (this.resonanceDone) return;
    if (this.upgradeLevel('rainbowResonance') === 0) return;
    if (this.threeChains.size >= 3) {
      this.resonanceDone = true;
      this.score += 800;
      this.addEffect('resonanceBoost');
      this.fx({ type: 'evolve', big: true, text: '极彩共鸣 +800', count: 40, color: '#B176FF' });
    }
  }

  // ---------- skills ----------
  private grantSkill(pos: Vec) {
    const kind = SKILL_LIST[Math.floor(this.rng() * SKILL_LIST.length)];
    if (this.skill && this.skill.kind === kind) {
      this.skill.charges = Math.min(this.skillMaxCharges(), this.skill.charges + 1);
    } else if (this.skill && this.skill.charges < this.skillMaxCharges()) {
      // recharge current skill instead of replacing (per design)
      this.skill.charges = Math.min(this.skillMaxCharges(), this.skill.charges + 1);
    } else {
      this.skill = { kind, charges: 1 };
    }
    this.fx({ type: 'skill', pos, skill: this.skill.kind, color: '#FFC857', count: 16, text: `获得技能` });
  }

  useSkill(): boolean {
    if (this.phase !== 'playing' || !this.skill || this.skill.charges <= 0) {
      if (this.skill && this.skill.charges <= 0) this.fx({ type: 'deny' });
      return false;
    }
    const kind = this.skill.kind;
    let ok = false;
    switch (kind) {
      case 'dash':
        ok = this.doDash();
        break;
      case 'magnet':
        this.addEffect('magnet');
        this.magnetAccum = 0;
        this.fx({ type: 'magnet', pos: this.snake[0], color: '#B176FF', count: 20 });
        ok = true;
        break;
      case 'slow':
        this.addEffect('slow');
        this.fx({ type: 'slow', pos: this.snake[0], color: '#43BFFF', count: 16 });
        ok = true;
        break;
      case 'shed': {
        const fraction = this.upgradeLevel('shedExpert') > 0 ? 0.35 : SHED_FRACTION;
        const n = Math.max(1, Math.round(this.snake.length * fraction));
        const cut = Math.min(n, this.snake.length - MIN_SNAKE_LENGTH);
        if (cut <= 0) {
          this.fx({ type: 'deny' });
          return false;
        }
        const pts = this.trimTailRaw(cut);
        this.fx({ type: 'shed', pos: this.snake[this.snake.length - 1], color: '#4EF1A3', count: 30, text: `+${pts}` });
        ok = true;
        break;
      }
    }
    if (ok) {
      this.skill.charges--;
      if (this.skill.charges <= 0) this.skill = null;
    }
    return ok;
  }

  private trimTailRaw(n: number): number {
    const cut = Math.min(n, Math.max(0, this.snake.length - MIN_SNAKE_LENGTH));
    if (cut <= 0) return 0;
    this.snake.splice(this.snake.length - cut, cut);
    this.growth = Math.max(0, this.growth - cut);
    let pts = SHED_SCORE_PER_SEGMENT * cut;
    if (this.upgradeLevel('shedExpert') > 0) pts *= 2;
    this.score += pts;
    return pts;
  }

  private doDash(): boolean {
    const d = DIRS[this.dir];
    const path: Vec[] = [];
    let cur: Vec = { x: this.snake[0].x, y: this.snake[0].y };
    for (let i = 0; i < DASH_DISTANCE; i++) {
      cur = { x: cur.x + d.x, y: cur.y + d.y };
      if (!this.inBounds(cur)) break;
      // body cells that will not vacate are blockers; approximate with current body minus tail
      const blocked = this.snake.some(
        (s, idx) => s.x === cur.x && s.y === cur.y && !(this.growth === 0 && idx === this.snake.length - 1),
      );
      if (blocked) break;
      path.push({ ...cur });
    }
    if (path.length === 0) {
      this.fx({ type: 'deny' });
      return false;
    }
    this.fx({ type: 'dash', pos: this.snake[0], color: '#FFC857', count: 24 });
    for (const cell of path) {
      this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
      this.snake.unshift({ x: cell.x, y: cell.y, color: this.lastEatenColor });
      this.snake.pop();
      const bean = this.beanAt(cell);
      if (bean) this.eatBean(bean);
      if (this.phase !== 'playing') return true; // upgrade modal may have opened
    }
    this.stats.maxLength = Math.max(this.stats.maxLength, this.snake.length);
    return true;
  }

  // ---------- upgrades ----------
  private pendingChoiceSource: 'milestone' | 'crown' | null = null;

  private checkUpgradeMilestone() {
    if (this.phase !== 'playing') return;
    if (this.score >= upgradeThreshold(this.nextUpgradeIndex)) {
      this.triggerUpgradeChoice('milestone');
    }
  }

  triggerUpgradeChoice(source: 'milestone' | 'crown' = 'crown') {
    if (this.phase !== 'playing') return;
    const choices = this.rollUpgradeChoices();
    if (choices.length === 0) {
      // all upgrades maxed: award bonus score instead
      if (source === 'milestone') this.nextUpgradeIndex++;
      this.score += 200;
      this.fx({ type: 'upgrade', text: '全部强化已满级 +200', count: 20, color: '#FFC857' });
      return;
    }
    this.upgradeChoices = choices;
    this.pendingChoiceSource = source;
    this.phase = 'upgrade';
    this.accumulator = 0;
    this.fx({ type: 'upgrade', count: 16, color: '#FFC857' });
  }

  private rollUpgradeChoices(): UpgradeId[] {
    const available = this.upgradesAvailable();
    const picks: UpgradeId[] = [];
    const pool = [...available];
    const n = Math.min(3, pool.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.rng() * pool.length);
      picks.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picks;
  }

  upgradesAvailable(): UpgradeId[] {
    return this.upgradesAvailableFrom(UPGRADE_IDS);
  }

  private upgradesAvailableFrom(ids: UpgradeId[]): UpgradeId[] {
    return ids.filter((id) => this.upgradeLevel(id) < UPGRADE_MAX[id]);
  }

  chooseUpgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade') return;
    if (!this.upgradeChoices.includes(id)) return;
    const lvl = this.upgradeLevel(id);
    this.upgrades.set(id, lvl + 1);
    if (id === 'secondLife') this.secondLifeUsed = false;
    this.upgradeChoices = [];
    this.phase = 'playing';
    if (this.pendingChoiceSource === 'milestone') this.nextUpgradeIndex++;
    this.pendingChoiceSource = null;
    this.fx({ type: 'upgrade', text: UPGRADE_NAMES[id], count: 20, color: '#FFC857' });
  }

  skipUpgrade() {
    if (this.phase !== 'upgrade') return;
    this.upgradeChoices = [];
    this.phase = 'playing';
    if (this.pendingChoiceSource === 'milestone') this.nextUpgradeIndex++;
    this.pendingChoiceSource = null;
  }

  // ---------- snapshot ----------
  getHud(): HudState {
    const stats: RunStats = {
      score: this.score,
      maxChain: this.stats.maxChain,
      maxLength: this.stats.maxLength,
      evolutions: this.stats.evolutions,
      timeAlive: this.elapsed,
      upgrades: [...this.upgrades.entries()].map(([id, level]) => ({ id, level })),
    };
    return {
      phase: this.phase,
      score: this.score,
      chain: { ...this.chain },
      snakeLength: this.snake.length,
      skill: this.skill ? { ...this.skill } : null,
      shields: this.shields,
      effects: this.effects.map((e) => ({ ...e })),
      activeEvent: this.activeEvent ? { ...this.activeEvent } : null,
      upgrades: stats.upgrades,
      upgradeChoices: [...this.upgradeChoices],
      stats,
      clonePending: this.clonePending,
      secondLifeUsed: this.secondLifeUsed,
      hasSecondLife: this.upgradeLevel('secondLife') > 0,
    };
  }
}

// milestone bookkeeping helper: engine advances index when a milestone-triggered upgrade is chosen
const UPGRADE_IDS: UpgradeId[] = [
  'redAmp',
  'flameCore',
  'extremeFever',
  'coldCore',
  'phaseArmor',
  'ghostExtend',
  'wildGrowth',
  'efficientMetabolism',
  'shedExpert',
  'chainAmp',
  'geneMemory',
  'rainbowResonance',
  'goldenGluttony',
  'skillCharge',
  'secondLife',
];

const UPGRADE_MAX: Record<UpgradeId, number> = {
  redAmp: 3,
  flameCore: 2,
  extremeFever: 1,
  coldCore: 2,
  phaseArmor: 2,
  ghostExtend: 2,
  wildGrowth: 2,
  efficientMetabolism: 2,
  shedExpert: 1,
  chainAmp: 3,
  geneMemory: 1,
  rainbowResonance: 1,
  goldenGluttony: 3,
  skillCharge: 2,
  secondLife: 1,
};

const UPGRADE_NAMES: Record<UpgradeId, string> = {
  redAmp: '赤红增幅',
  flameCore: '烈焰核心',
  extremeFever: '极限狂热',
  coldCore: '寒潮核心',
  phaseArmor: '相位装甲',
  ghostExtend: '幽体延展',
  wildGrowth: '野蛮生长',
  efficientMetabolism: '高效代谢',
  shedExpert: '蜕皮专家',
  chainAmp: '连锁增幅',
  geneMemory: '基因记忆',
  rainbowResonance: '极彩共鸣',
  goldenGluttony: '黄金吞噬',
  skillCharge: '技能充能',
  secondLife: '第二生命',
};

export { UPGRADE_IDS, UPGRADE_MAX, UPGRADE_NAMES };
