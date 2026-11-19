import {
  AMBIENT_FIRST_DELAY,
  AMBIENT_INTERVAL_MAX,
  AMBIENT_INTERVAL_MIN,
  AMBIENT_SPAWN_MAX,
  AMBIENT_SPAWN_MIN,
  BASE_BEAN_SCORE,
  BASE_SPEED,
  BERSERK_SPEED_BONUS,
  CHAIN_MULT,
  CHARGED_SPEED_MULT,
  COLD_CORE_SLOW_FACTOR,
  CORRUPT_CHANCE,
  CORRUPT_MIN,
  CORRUPT_SCORE_FRACTION,
  CROWN_CHANCE,
  CROWN_COOLDOWN,
  CLONE_CHANCE,
  CULL_RADIUS,
  DASH_DISTANCE,
  EFFECT_DURATION,
  EFFECT_SCORE_MULT,
  ELEMENT_BEAN_TARGET,
  ELEMENT_COLORS,
  ELEMENT_EFFECT,
  ELEMENT_LIST,
  ELEMENT_NAMES,
  ELEMENT_STACK_BONUS,
  EAT_RADIUS,
  EVENT_DEFS,
  EVENT_FIRST_DELAY,
  EVENT_GAP_MAX,
  EVENT_GAP_MIN,
  FOG_CHANCE,
  GENE_BEAN_TARGET,
  GENE_STORM_EXTRA,
  GOLDEN_TIME_MULT,
  GRID,
  HASTE_CHANCE,
  HASTE_SPEED_MULT,
  HIT_INVULN,
  MAGNET_RADIUS,
  MAINTAIN_DIST,
  MAX_CHAIN,
  MAX_SPEED,
  MAX_TOTAL_MULTIPLIER,
  MIN_SNAKE_LENGTH,
  MIN_SPAWN_DIST,
  MORPH_STAGE_NAMES,
  OBSTACLE_EDGE_GAP,
  OBSTACLE_MAX,
  OBSTACLE_MIN,
  OBSTACLE_SEP,
  OBSTACLE_SIZE_MAX,
  OBSTACLE_SIZE_MIN,
  OBSTACLE_SPAWN_GAP,
  OVERLOAD_SPEED_MULT,
  PURIFY_CHANCE,
  PURIFY_SCORE_BONUS,
  RAINBOW_CHANCE,
  RAINBOW_TIDE_MULT,
  REACTIONS,
  SEG_SPACING,
  SELF_HIT_DIST,
  SELF_HIT_SKIP,
  SHED_FRACTION,
  SHED_SCORE_PER_SEGMENT,
  SHIELD_CAP_BASE,
  SHIELD_CHANCE,
  SKILL_BEAN_CHANCE,
  SKILL_MAX_CHARGES_BASE,
  SLOW_FACTOR,
  SPAWN_RADIUS,
  SPEED_SCORE_RAMP,
  SUPERCONDUCT_SLOW_FACTOR,
  TURN_RATE,
  WALL_MARGIN,
  WEAK_CHANCE,
  morphSummary,
  upgradeThreshold,
} from './config';
import {
  ATTACK_BASE_DPS,
  ATTACK_BOLT_DMG,
  ATTACK_BOLT_INTERVAL,
  ATTACK_BOLT_SPEED,
  ATTACK_CAP_MULT,
  ATTACK_FORM_MULT,
  ATTACK_LOCK_RANGE,
  BLUE_DMG_MULT,
  BLUE_SHOT_INTERVAL,
  BLUE_SHOT_RADIUS,
  BLUE_SHOT_SPEED,
  BOSS_CROWN_CHANCE,
  BOSS_CONTACT_COOLDOWN,
  BOSS_CONTACT_DMG,
  BOSS_ENGAGE_MAX,
  BOSS_ENGAGE_MIN,
  BOSS_GENE_DROPS,
  BOSS_HIT_RADIUS,
  BOSS_HP_PER_SCORE,
  BOSS_KILL_SCORE_FRAC,
  BOSS_P1_DMG,
  BOSS_P1_INTERVAL,
  BOSS_P2_DMG,
  BOSS_P2_INTERVAL,
  BOSS_P2_SPREAD,
  BOSS_P3_AIMED_DMG,
  BOSS_P3_AIMED_INTERVAL,
  BOSS_P3_RING_COUNT,
  BOSS_P3_RING_DMG,
  BOSS_P3_RING_GAPS,
  BOSS_P3_RING_INTERVAL,
  BOSS_P3_SPECIAL_DMG,
  BOSS_P3_SPECIAL_INTERVAL,
  BOSS_PHASE2_FRAC,
  BOSS_PHASE3_FRAC,
  BOSS_RETARGET_MAX,
  BOSS_RETARGET_MIN,
  BOSS_SPAWN_EDGE,
  BOSS_SPAWN_MAX,
  BOSS_SPAWN_MIN,
  BOSS_SPEED_FRAC,
  BOSS_STEP,
  BOSS_TELEGRAPH,
  BOSS_WOBBLE,
  BULLET_LIFE,
  BULLET_MUZZLE,
  BULLET_RADIUS,
  BULLET_SPEED,
  CHAIN_LIGHTNING_FALLOFF,
  CHAIN_LIGHTNING_RANGE,
  ELEMENT_ATTACK_AMP,
  FREEZE_DURATION,
  FREEZE_FIRE_MULT,
  FREEZE_MOVE_MULT,
  GOLDEN_TIME_ATTACK_MULT,
  GREEN_DMG_MULT,
  GREEN_SHOT_INTERVAL,
  GREEN_SHOT_RADIUS,
  GREEN_SHOT_SPEED,
  MINION_CAP,
  MINION_HIT_RADIUS,
  MINION_HP_FRAC,
  MINION_KILL_SCORE_FRAC,
  MINION_KNOCKBACK,
  MINION_PER_SUMMON,
  MINION_RAM_DMG,
  MINION_SPAWN_OFFSET,
  MINION_SPEED_FRAC,
  MINION_STEER_LOCK,
  MINION_SUMMON_INTERVAL,
  OVERLOAD_SHIELD_COOLDOWN,
  POISON_DPS_PER_SEC,
  POISON_DURATION,
  POISON_KILL_HEAL_FRAC,
  POISON_MAX_STACKS,
  PRISM_ATTACK_MULT,
  PRISM_BULLET_SPEED,
  PRISM_COLUMN_OFFSET,
  PRISM_DMG_FRAC,
  PRISM_SHOT_INTERVAL,
  RED_DMG_MULT,
  RED_SHOT_INTERVAL,
  RED_SHOT_RADIUS,
  RED_SHOT_SPEED,
  SUPERCONDUCT_BOSS_SLOW,
} from './config';
import { mulberry32, randomSeed } from './rng';
import type {
  AttackForm,
  Bean,
  BeanKind,
  BossState,
  BulletState,
  ChainState,
  ElementKind,
  EventKind,
  FxEvent,
  GameEvent,
  GamePhase,
  GeneColor,
  HudState,
  MinionState,
  MorphState,
  Obstacle,
  PlayerShot,
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

const GENE_LIST: GeneColor[] = ['red', 'blue', 'green'];
const SKILL_LIST: SkillKind[] = ['dash', 'magnet', 'slow', 'shed'];

const GENE_SET = new Set<BeanKind>(GENE_LIST);
const ELEMENT_SET = new Set<BeanKind>(ELEMENT_LIST);
const isGeneKind = (k: BeanKind): boolean => GENE_SET.has(k);
const isElementKind = (k: BeanKind): boolean => ELEMENT_SET.has(k);

export class GameEngine {
  phase: GamePhase = 'playing';
  snake: SnakeSegment[] = [];
  prevSnake: Vec[] = [];
  /** Movement heading in radians (0 = +x/right). Continuous free-angle steering. */
  heading = 0;
  /** Nearest 4-dir label derived from heading, kept for HUD/particles compatibility. */
  dir = 'right';
  private steerX = 0;
  private steerY = 0;
  /** Trail of recent head positions (newest first) used to place body segments. */
  private path: Vec[] = [];
  private growth = 0;
  private lastEatenColor: GeneColor = 'green';
  /** Post-hit invulnerability timer (seconds). */
  private invuln = 0;

  beans: Bean[] = [];
  private beanId = 1;

  score = 0;
  chain: ChainState = { color: null, count: 0 };
  effects: TimedEffect[] = [];
  shields = 0;
  skill: SkillState | null = null;
  clonePending = false;
  upgrades: Map<UpgradeId, number> = new Map();
  morph: MorphState = { tiers: { red: 0, blue: 0, green: 0 }, prism: false };

  activeEvent: GameEvent | null = null;
  private nextEventIn = EVENT_FIRST_DELAY;
  private lastCrownAt = -CROWN_COOLDOWN;
  private elapsed = 0;
  private lastMaintain: Vec = { x: 0, y: 0 };

  private nextUpgradeIndex = 0;
  upgradeChoices: UpgradeId[] = [];

  fxQueue: FxEvent[] = [];
  private rng: () => number;
  private geneMemoryUsed = false;
  private threeChains: Set<GeneColor> = new Set();
  private resonanceDone = false;
  secondLifeUsed = false;

  // ---------- combat ----------
  boss: BossState | null = null;
  bullets: BulletState[] = [];
  minions: MinionState[] = [];
  playerShots: PlayerShot[] = [];
  /** Rubble slabs generated per run: lethal to the head, stop bullets. Public for the renderer. */
  obstacles: Obstacle[] = [];
  /** Highest score reached this run; boss thresholds & upgrade milestones key off it. */
  peakScore = 0;
  private bossIndex = 0; // next boss threshold index (one-time consumption)
  private bossQueue = 0; // bosses earned but waiting for the active slot
  private combatId = 1;
  /** Public for the renderer: current attack input state (melee forms have no projectiles to draw). */
  attackActive = false;
  /** Attack aim — always derived from `heading` at the end of every update. */
  aimX = 1;
  aimY = 0;
  private attackCooldown = 0;
  private poisonStacks = 0; // green-attack poison DoT stacks on the active boss
  private poisonTimer = 0;
  private overloadShieldCd = 0;
  private steerLock = 0; // minion-ram steering interruption timer
  private ambientTimer = AMBIENT_FIRST_DELAY; // wild-minion spawn countdown (paused while a boss lives)

  stats = {
    maxChain: 0,
    maxLength: 0,
    evolutions: 0,
    totalEaten: 0,
    bossesKilled: 0,
  };

  constructor(seed?: number) {
    this.rng = mulberry32(seed ?? randomSeed());
    this.reset(seed);
  }

  reset(seed?: number) {
    if (seed !== undefined) this.rng = mulberry32(seed);
    this.phase = 'playing';
    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    this.snake = [
      { x: cx, y: cy, color: 'green' },
      { x: cx - 1, y: cy, color: 'green' },
      { x: cx - 2, y: cy, color: 'green' },
    ];
    this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
    this.heading = 0;
    this.dir = 'right';
    this.steerX = 0;
    this.steerY = 0;
    this.invuln = 0;
    this.path = [];
    // seed a straight trail behind the head so the body lays out immediately
    const need = this.snake.length * SEG_SPACING + 1;
    for (let d = 0; d <= need; d += SEG_SPACING / 2) {
      this.path.push({ x: cx - d, y: cy });
    }
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
    this.morph = { tiers: { red: 0, blue: 0, green: 0 }, prism: false };
    this.activeEvent = null;
    this.nextEventIn = EVENT_FIRST_DELAY;
    this.lastCrownAt = -CROWN_COOLDOWN;
    this.elapsed = 0;
    this.lastMaintain = { x: cx, y: cy };
    this.nextUpgradeIndex = 0;
    this.upgradeChoices = [];
    this.fxQueue = [];
    this.geneMemoryUsed = false;
    this.threeChains = new Set();
    this.resonanceDone = false;
    this.secondLifeUsed = false;
    this.boss = null;
    this.bullets = [];
    this.minions = [];
    this.playerShots = [];
    this.peakScore = 0;
    this.bossIndex = 0;
    this.bossQueue = 0;
    this.combatId = 1;
    this.attackActive = false;
    this.aimX = 1;
    this.aimY = 0;
    this.attackCooldown = 0;
    this.poisonStacks = 0;
    this.poisonTimer = 0;
    this.overloadShieldCd = 0;
    this.ambientTimer = AMBIENT_FIRST_DELAY;
    this.steerLock = 0;
    this.stats = { maxChain: 0, maxLength: 0, evolutions: 0, totalEaten: 0, bossesKilled: 0 };
    this.generateObstacles();
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
    if (this.isBlocked(p.x, p.y)) return false;
    // block cells the continuous body overlaps (segments are float, cells are integer)
    if (this.snake.some((s) => Math.abs(s.x - p.x) < 0.75 && Math.abs(s.y - p.y) < 0.75)) return false;
    if (this.beans.some((b) => !ignoreBeanIds.has(b.id) && b.pos.x === p.x && b.pos.y === p.y)) return false;
    return true;
  }

  private cheb(a: Vec, b: Vec): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  // ---------- obstacles ----------
  /** Sparse lethal rubble slabs, seeded → deterministic per run. Also act as bullet cover. */
  private generateObstacles() {
    this.obstacles = [];
    const n = OBSTACLE_MIN + Math.floor(this.rng() * (OBSTACLE_MAX - OBSTACLE_MIN + 1));
    const cx = GRID / 2;
    const cy = GRID / 2;
    const span = GRID - 2 * OBSTACLE_EDGE_GAP;
    for (let tries = 0; tries < 400 && this.obstacles.length < n; tries++) {
      const w = OBSTACLE_SIZE_MIN + Math.floor(this.rng() * (OBSTACLE_SIZE_MAX - OBSTACLE_SIZE_MIN + 1));
      const h = OBSTACLE_SIZE_MIN + Math.floor(this.rng() * (OBSTACLE_SIZE_MAX - OBSTACLE_SIZE_MIN + 1));
      const x = OBSTACLE_EDGE_GAP + Math.floor(this.rng() * (span - w + 1));
      const y = OBSTACLE_EDGE_GAP + Math.floor(this.rng() * (span - h + 1));
      // keep the player spawn area clear (point-to-rect distance)
      const dx = Math.max(x - cx, 0, x + w - cx);
      const dy = Math.max(y - cy, 0, y + h - cy);
      if (Math.hypot(dx, dy) < OBSTACLE_SPAWN_GAP) continue;
      const tooClose = this.obstacles.some(
        (o) => x < o.x + o.w + OBSTACLE_SEP && o.x < x + w + OBSTACLE_SEP && y < o.y + o.h + OBSTACLE_SEP && o.y < y + h + OBSTACLE_SEP,
      );
      if (tooClose) continue;
      this.obstacles.push({ x, y, w, h });
    }
  }

  /** True when the continuous point (x, y) falls inside an obstacle cell. */
  isBlocked(x: number, y: number): boolean {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    for (const o of this.obstacles) {
      if (gx >= o.x && gx < o.x + o.w && gy >= o.y && gy < o.y + o.h) return true;
    }
    return false;
  }

  /** Free cells reachable from the head within a local window, keeping the area
   *  around the player dense and never spawning beans in unreachable pockets. */
  private localReachableFree(radius: number): Vec[] {
    const head = this.snake[0];
    const hx = Math.round(head.x);
    const hy = Math.round(head.y);
    const x0 = Math.max(0, hx - radius);
    const x1 = Math.min(GRID - 1, hx + radius);
    const y0 = Math.max(0, hy - radius);
    const y1 = Math.min(GRID - 1, hy + radius);
    const free = new Set<number>();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.isFreeCell({ x, y })) free.add(y * GRID + x);
      }
    }
    const decode = (k: number): Vec => ({ x: k % GRID, y: Math.floor(k / GRID) });
    const start = hy * GRID + hx;
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const cx = cur % GRID;
      const cy = (cur - cx) / GRID;
      for (const d of Object.values(DIRS)) {
        const nx = cx + d.x;
        const ny = cy + d.y;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const key = ny * GRID + nx;
        if (seen.has(key)) continue;
        seen.add(key);
        if (free.has(key)) queue.push(key);
      }
    }
    const reachable = [...free].filter((k) => seen.has(k)).map(decode);
    return reachable.length > 0 ? reachable : [...free].map(decode);
  }

  private pickSpawnCell(): Vec | null {
    const head = this.snake[0];
    const pool = this.localReachableFree(SPAWN_RADIUS);
    if (pool.length === 0) return null;
    const far = pool.filter((c) => this.cheb(c, head) >= MIN_SPAWN_DIST);
    const final = far.length > 0 ? far : pool;
    return final[Math.floor(this.rng() * final.length)];
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
    this.spawnBean(this.pickElement());
    const head = this.snake[0];
    this.lastMaintain = { x: head.x, y: head.y };
  }

  /** Choose an element, biasing toward diversity so fusion reactions stay reachable. */
  private pickElement(): ElementKind {
    const present = new Set<BeanKind>(this.beans.filter((b) => isElementKind(b.kind)).map((b) => b.kind));
    let pool = ELEMENT_LIST.filter((e) => !present.has(e));
    if (pool.length === 0) pool = ELEMENT_LIST;
    return pool[Math.floor(this.rng() * pool.length)];
  }

  private maintainBeans() {
    const head = this.snake[0];
    this.lastMaintain = { x: head.x, y: head.y };
    // despawn beans that have drifted far behind the player
    this.beans = this.beans.filter((b) => this.cheb(b.pos, head) <= CULL_RADIUS);
    const inWindow = (b: Bean) => this.cheb(b.pos, head) <= SPAWN_RADIUS;

    // keep at least one of each gene color near the head
    for (const g of GENE_LIST) {
      if (!this.beans.some((b) => b.kind === g && inWindow(b))) this.spawnBean(g);
    }
    // keep the local gene-bean population at target
    const geneCount = this.beans.filter((b) => isGeneKind(b.kind) && inWindow(b)).length;
    const target = GENE_BEAN_TARGET + (this.activeEvent?.kind === 'geneStorm' ? GENE_STORM_EXTRA : 0);
    for (let i = geneCount; i < target; i++) {
      this.spawnBean(GENE_LIST[Math.floor(this.rng() * 3)]);
    }
    // keep element beans near the head so fusion reactions can chain
    const elCount = this.beans.filter((b) => isElementKind(b.kind) && inWindow(b)).length;
    for (let i = elCount; i < ELEMENT_BEAN_TARGET; i++) this.spawnBean(this.pickElement());

    // rare special beans (at most one of each on the board)
    const unique = (kind: BeanKind, chance: number) => {
      if (!this.beans.some((b) => b.kind === kind) && this.rng() < chance) this.spawnBean(kind);
    };
    const rainbowChance = RAINBOW_CHANCE * (this.activeEvent?.kind === 'rainbowTide' ? RAINBOW_TIDE_MULT : 1);
    unique('rainbow', rainbowChance);
    unique('clone', CLONE_CHANCE);
    unique('skill', SKILL_BEAN_CHANCE);
    // debuff beans
    unique('haste', HASTE_CHANCE);
    unique('fog', FOG_CHANCE);
    unique('weak', WEAK_CHANCE);
    unique('corrupt', CORRUPT_CHANCE);
    // beneficial beans
    unique('shield', SHIELD_CHANCE);
    unique('purify', PURIFY_CHANCE);
    // crown (on cooldown)
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
  }

  // ---------- speed ----------
  speed(): number {
    let s = BASE_SPEED;
    s += Math.min(MAX_SPEED - BASE_SPEED, (this.score / SPEED_SCORE_RAMP) * (MAX_SPEED - BASE_SPEED));
    if (this.hasEffect('berserk')) s += BERSERK_SPEED_BONUS;
    if (this.upgradeLevel('extremeFever') > 0 && this.chain.color === 'red' && this.chain.count >= MAX_CHAIN) s += 0.32;
    // speed boosts: haste is a debuff; charged/overload come from element reactions
    if (this.hasEffect('haste')) s *= HASTE_SPEED_MULT;
    if (this.hasEffect('charged')) s *= CHARGED_SPEED_MULT;
    if (this.hasEffect('overload')) s *= OVERLOAD_SPEED_MULT;
    // slow effects
    if (
      this.hasEffect('slow') ||
      this.hasEffect('condense') ||
      this.hasEffect('afterimage') ||
      this.hasEffect('iceArmor')
    ) {
      s *= this.upgradeLevel('coldCore') > 0 ? COLD_CORE_SLOW_FACTOR : SLOW_FACTOR;
    }
    if (this.hasEffect('superconduct')) s *= SUPERCONDUCT_SLOW_FACTOR;
    if (this.hasEffect('ghost')) s *= 0.85;
    return Math.max(1.2, Math.min(MAX_SPEED + 1.2, s));
  }

  hasEffect(kind: TimedEffect['kind']): boolean {
    return this.effects.some((e) => e.kind === kind);
  }

  /** Continuous movement: positions are already final each frame, no interpolation. */
  stepProgress(): number {
    return 1;
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

  private removeEffect(kind: TimedEffect['kind']) {
    this.effects = this.effects.filter((e) => e.kind !== kind);
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
  /** Set the desired travel direction as a vector (screen space: +y is down). Zero = keep going straight. */
  setSteer(dx: number, dy: number) {
    this.steerX = dx;
    this.steerY = dy;
  }

  /** Convenience wrapper for 4-dir inputs (dpad/touch); maps a direction name to a steer vector. */
  enqueueDir(dir: string) {
    const d = DIRS[dir];
    if (!d) return;
    this.setSteer(d.x, d.y);
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
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    this.move(dt);
    if (this.phase === 'playing') {
      if (this.score > this.peakScore) this.peakScore = this.score;
      this.tickCombat(dt);
    }
    // keep the compatibility snapshot in sync (renderer no longer interpolates)
    this.prevSnake = this.snake.map((s) => ({ x: s.x, y: s.y }));
    // derive the 4-dir label from heading for HUD/particles
    this.dir = this.dirFromHeading(this.heading);
    // attack aim always tracks the head's heading
    this.aimX = Math.cos(this.heading);
    this.aimY = Math.sin(this.heading);
  }

  private dirFromHeading(h: number): string {
    const a = ((h % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (a < Math.PI / 4 || a >= Math.PI * 1.75) return 'right';
    if (a < Math.PI * 0.75) return 'down';
    if (a < Math.PI * 1.25) return 'left';
    return 'up';
  }

  /** Rotate `a` toward `b` by at most `maxStep` radians, taking the short way around. */
  private rotateToward(a: number, b: number, maxStep: number): number {
    const twoPi = Math.PI * 2;
    let diff = (b - a) % twoPi;
    if (diff > Math.PI) diff -= twoPi;
    if (diff < -Math.PI) diff += twoPi;
    if (diff > maxStep) diff = maxStep;
    if (diff < -maxStep) diff = -maxStep;
    return a + diff;
  }

  private move(dt: number) {
    // steering: rotate heading toward the input vector at a bounded turn rate
    if (this.steerLock > 0) {
      // a minion ram briefly locks out steering
      this.steerLock = Math.max(0, this.steerLock - dt);
    } else if (this.steerX !== 0 || this.steerY !== 0) {
      const target = Math.atan2(this.steerY, this.steerX);
      this.heading = this.rotateToward(this.heading, target, TURN_RATE * dt);
    }

    if (this.stunLock) {
      // frozen after a second-life save: no forward motion until the player steers to safety
      if (this.probeSafe()) this.stunLock = false;
      else if (!this.anyEscape()) this.die('stuck');
      if (this.stunLock) return;
    }

    const sp = this.speed();
    const head = this.snake[0];
    const nx = head.x + Math.cos(this.heading) * sp * dt;
    const ny = head.y + Math.sin(this.heading) * sp * dt;

    // wall collision
    if (nx < -WALL_MARGIN || nx > GRID - WALL_MARGIN || ny < -WALL_MARGIN || ny > GRID - WALL_MARGIN) {
      this.handleFatal('wall', head);
      return;
    }
    // obstacle collision: rubble slabs are lethal like walls
    if (this.isBlocked(nx, ny)) {
      this.handleFatal('wall', head);
      return;
    }

    head.x = nx;
    head.y = ny;

    // trail + body layout
    this.pushPath(head);
    this.applyGrowth();
    this.layoutBody();

    // self collision (skip the neck, which naturally hugs the head on curves)
    const hitIndex = this.selfHitIndex();
    if (hitIndex >= 0 && this.invuln <= 0) {
      if (this.shields > 0) {
        this.shields--;
        this.snake.splice(hitIndex);
        this.growth = 0;
        this.invuln = HIT_INVULN;
        this.fx({ type: 'shieldBreak', pos: { x: head.x, y: head.y }, color: '#43BFFF', count: 26 });
      } else {
        this.handleFatal('self', head);
        return;
      }
    }

    // eat any bean the head overlaps
    this.eatNearbyBeans();

    // keep beans fresh ahead of the player as the head travels across the big map
    if (this.phase === 'playing' && this.cheb(this.snake[0], this.lastMaintain) >= MAINTAIN_DIST) {
      this.maintainBeans();
    }
  }

  private pushPath(head: Vec) {
    const last = this.path[0];
    // Only record a new trail point once the head has drifted a little from the
    // last one. Crucially we do NOT slide path[0] onto the head: doing so would
    // keep the anchor glued to the head and the trail would never accumulate,
    // collapsing the body into a straight line even while turning.
    if (!last || Math.hypot(head.x - last.x, head.y - last.y) >= SEG_SPACING / 12) {
      this.path.unshift({ x: head.x, y: head.y });
    }
    // trim the trail to just beyond what the body needs
    const need = this.snake.length * SEG_SPACING + SEG_SPACING * 2;
    let acc = 0;
    for (let i = 1; i < this.path.length; i++) {
      acc += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y);
      if (acc > need) {
        this.path.length = i + 1;
        break;
      }
    }
  }

  private applyGrowth() {
    while (this.growth > 0) {
      this.growth--;
      const tail = this.snake[this.snake.length - 1];
      this.snake.push({ x: tail.x, y: tail.y, color: this.lastEatenColor });
    }
  }

  /** Place every body segment at a fixed arc-length spacing along the head trail. */
  private layoutBody() {
    const n = this.snake.length;
    if (n <= 1) return;
    let segIdx = 1;
    let acc = 0;
    for (let p = 1; p < this.path.length && segIdx < n; p++) {
      const a = this.path[p - 1];
      const b = this.path[p];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d === 0) continue;
      while (segIdx < n && acc + d >= segIdx * SEG_SPACING) {
        const t = (segIdx * SEG_SPACING - acc) / d;
        const seg = this.snake[segIdx];
        seg.x = a.x + (b.x - a.x) * t;
        seg.y = a.y + (b.y - a.y) * t;
        segIdx++;
      }
      acc += d;
    }
    // path shorter than the body: stack the remainder at the trail end
    const end = this.path[this.path.length - 1] ?? this.snake[0];
    for (; segIdx < n; segIdx++) {
      this.snake[segIdx].x = end.x;
      this.snake[segIdx].y = end.y;
    }
    this.stats.maxLength = Math.max(this.stats.maxLength, n);
  }

  private selfHitIndex(): number {
    const head = this.snake[0];
    for (let i = SELF_HIT_SKIP; i < this.snake.length; i++) {
      const s = this.snake[i];
      if (Math.hypot(head.x - s.x, head.y - s.y) < SELF_HIT_DIST) return i;
    }
    return -1;
  }

  /** Is the point one cell ahead of the head safe (in bounds and clear of the body)? */
  private probeSafe(): boolean {
    const head = this.snake[0];
    const px = head.x + Math.cos(this.heading);
    const py = head.y + Math.sin(this.heading);
    if (px < -WALL_MARGIN || px > GRID - WALL_MARGIN || py < -WALL_MARGIN || py > GRID - WALL_MARGIN) return false;
    if (this.isBlocked(px, py)) return false;
    for (let i = SELF_HIT_SKIP; i < this.snake.length; i++) {
      const s = this.snake[i];
      if (Math.hypot(px - s.x, py - s.y) < SELF_HIT_DIST) return false;
    }
    return true;
  }

  /** Any heading that leads somewhere safe (used to detect a truly trapped snake). */
  private anyEscape(): boolean {
    const saved = this.heading;
    for (let k = 0; k < 8; k++) {
      this.heading = (k / 8) * Math.PI * 2;
      if (this.probeSafe()) {
        this.heading = saved;
        return true;
      }
    }
    this.heading = saved;
    return false;
  }

  private eatNearbyBeans() {
    const head = this.snake[0];
    for (const bean of [...this.beans]) {
      const bcx = bean.pos.x;
      const bcy = bean.pos.y;
      if (Math.hypot(head.x - bcx, head.y - bcy) <= EAT_RADIUS) {
        this.eatBean(bean);
        if (this.phase !== 'playing') return;
      }
    }
  }

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

  // ---------- fatal handling ----------
  private stunLock = false;

  private handleFatal(cause: 'wall' | 'self' | 'score', at: Vec) {
    if (!this.secondLifeUsed && this.upgradeLevel('secondLife') > 0) {
      this.secondLifeUsed = true;
      // freeze in place: the player must steer toward a safe heading to resume
      this.stunLock = true;
      this.invuln = Math.max(this.invuln, HIT_INVULN);
      this.fx({ type: 'secondLife', pos: { x: at.x, y: at.y }, color: '#FFC857', count: 40, text: cause });
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
      case 'haste':
        this.addEffect('haste');
        this.fx({ type: 'debuff', pos: bean.pos, color: '#FF7A45', count: 16, text: '加速失控!' });
        this.maintainBeans();
        break;
      case 'fog':
        this.addEffect('fog');
        this.fx({ type: 'debuff', pos: bean.pos, color: '#9AA6BD', count: 16, text: '视野受限' });
        this.maintainBeans();
        break;
      case 'weak':
        this.addEffect('weak');
        this.fx({ type: 'debuff', pos: bean.pos, color: '#9B7BB5', count: 16, text: '虚弱' });
        this.maintainBeans();
        break;
      case 'corrupt': {
        const loss = this.computeCorruptLoss();
        this.score = Math.max(0, this.score - loss);
        this.fx({ type: 'debuff', pos: bean.pos, color: '#C43A52', count: 18, text: `-${loss}` });
        this.maintainBeans();
        break;
      }
      case 'shield':
        this.addShields(1);
        this.fx({ type: 'buff', pos: bean.pos, color: '#43BFFF', count: 16, text: '护盾 +1' });
        this.maintainBeans();
        break;
      case 'purify': {
        const cleared = this.purifyDebuffs();
        this.score += PURIFY_SCORE_BONUS;
        this.fx({
          type: 'buff',
          pos: bean.pos,
          color: '#B7FFDD',
          count: 20,
          text: cleared ? '净化!' : `净化 +${PURIFY_SCORE_BONUS}`,
        });
        this.maintainBeans();
        break;
      }
      case 'fire':
      case 'ice':
      case 'lightning':
        this.eatElement(bean.kind, bean.pos);
        this.maintainBeans();
        break;
    }
  }

  // ---------- debuff / buff beans ----------
  private computeCorruptLoss(): number {
    const loss = Math.max(CORRUPT_MIN, Math.round(this.score * CORRUPT_SCORE_FRACTION));
    return Math.min(this.score, loss);
  }

  private purifyDebuffs(): boolean {
    const before = this.effects.length;
    this.removeEffect('haste');
    this.removeEffect('fog');
    this.removeEffect('weak');
    return this.effects.length < before;
  }

  // ---------- element beans & fusion reactions ----------
  /** Which element is currently infused (its effect also serves as the reaction window). */
  private activeElement(): ElementKind | null {
    if (this.hasEffect('fireAtk')) return 'fire';
    if (this.hasEffect('iceArmor')) return 'ice';
    if (this.hasEffect('charged')) return 'lightning';
    return null;
  }

  private applyElementSolo(el: ElementKind) {
    this.addEffect(ELEMENT_EFFECT[el]);
  }

  private eatElement(el: ElementKind, pos: Vec) {
    const color = ELEMENT_COLORS[el];
    const prev = this.activeElement();
    if (prev === el) {
      // same element: refresh + enhance
      this.applyElementSolo(el);
      this.addScore(ELEMENT_STACK_BONUS, pos, color, false, 1);
      this.fx({ type: 'buff', pos, color, count: 14, text: `${ELEMENT_NAMES[el]}·强化` });
    } else if (prev) {
      // different element while one is active → fusion reaction
      this.removeEffect('fireAtk');
      this.removeEffect('iceArmor');
      this.removeEffect('charged');
      this.triggerReaction(prev, el, pos);
    } else {
      // no element active → apply infusion (opens the reaction window)
      this.applyElementSolo(el);
      this.fx({ type: 'buff', pos, color, count: 12, text: `${ELEMENT_NAMES[el]}蕴` });
    }
  }

  private triggerReaction(a: ElementKind, b: ElementKind, pos: Vec) {
    const key = [a, b].sort().join('+');
    const def = REACTIONS[key];
    if (!def) return;
    this.addEffect(def.effect);
    if (def.shield) this.addShields(def.shield);
    this.addScore(def.bonus, pos, def.color, false, 1);
    this.fx({
      type: 'reaction',
      pos,
      color: def.color,
      count: 40,
      big: true,
      text: `${def.name} +${def.bonus}`,
    });
  }

  private eatGene(color: GeneColor, pos: Vec) {
    this.lastEatenColor = color;
    const prevCount = this.chain.color === color ? this.chain.count : 0;
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
    this.applyChainEffects(color, pos, prevCount);

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

  private applyChainEffects(color: GeneColor, pos: Vec, prevCount: number) {
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
      // permanent appearance evolution — only on the transition into 5-chain
      if (prevCount < MAX_CHAIN) {
        this.morph.tiers[color]++;
        const ms = morphSummary(this.morph);
        this.fx({
          type: 'evolve',
          pos,
          gene: color,
          count: 40,
          text: `${this.chainName(color, 5)} → ${ms.name}·${MORPH_STAGE_NAMES[ms.stage]}`,
          big: true,
        });
      }
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
      this.morph.prism = true;
      this.fx({ type: 'evolve', big: true, text: '极彩共鸣 +800 · 虹彩巨蛇觉醒', count: 40, color: '#B176FF' });
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
    const head = this.snake[0];
    const start = { x: head.x, y: head.y };
    const dx = Math.cos(this.heading);
    const dy = Math.sin(this.heading);
    const samples: Vec[] = [];
    const stepSize = 0.3;
    let dist = 0;
    let cx = start.x;
    let cy = start.y;
    while (dist < DASH_DISTANCE) {
      const s = Math.min(stepSize, DASH_DISTANCE - dist);
      cx += dx * s;
      cy += dy * s;
      dist += s;
      if (cx < -WALL_MARGIN || cx > GRID - WALL_MARGIN || cy < -WALL_MARGIN || cy > GRID - WALL_MARGIN) break;
      let blocked = false;
      for (let i = SELF_HIT_SKIP; i < this.snake.length; i++) {
        if (Math.hypot(cx - this.snake[i].x, cy - this.snake[i].y) < SELF_HIT_DIST) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      samples.push({ x: cx, y: cy });
    }
    if (samples.length === 0) {
      this.fx({ type: 'deny' });
      return false;
    }
    this.fx({ type: 'dash', pos: { x: start.x, y: start.y }, color: '#FFC857', count: 24 });
    // devour beans along the swept corridor
    for (const bean of [...this.beans]) {
      const near =
        Math.hypot(bean.pos.x - start.x, bean.pos.y - start.y) <= EAT_RADIUS ||
        samples.some((sp) => Math.hypot(bean.pos.x - sp.x, bean.pos.y - sp.y) <= EAT_RADIUS);
      if (near) {
        this.eatBean(bean);
        if (this.phase !== 'playing') return true; // upgrade modal may have opened
      }
    }
    // teleport the head to the dash end and stitch the corridor into the trail
    const end = samples[samples.length - 1];
    head.x = end.x;
    head.y = end.y;
    for (let i = 0; i < samples.length; i++) this.path.unshift(samples[i]);
    this.layoutBody();
    this.stats.maxLength = Math.max(this.stats.maxLength, this.snake.length);
    return true;
  }

  // ---------- upgrades ----------
  private pendingChoiceSource: 'milestone' | 'crown' | null = null;

  private checkUpgradeMilestone() {
    if (this.phase !== 'playing') return;
    if (this.score > this.peakScore) this.peakScore = this.score;
    if (this.peakScore >= upgradeThreshold(this.nextUpgradeIndex)) {
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

  // ---------- combat: score-as-HP, tower bosses, bullets, minions, player attack ----------
  private clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
  }

  private bulletSpeed(): number {
    return BULLET_SPEED * (this.hasEffect('iceArmor') ? 0.75 : 1);
  }

  private checkBossSpawn() {
    // consume score thresholds by peak score, one time each
    while (this.peakScore >= BOSS_STEP * (this.bossIndex + 1)) {
      this.bossIndex++;
      this.bossQueue++;
    }
    if (!this.boss && this.bossQueue > 0) {
      this.bossQueue--;
      this.spawnBoss();
    }
  }

  private spawnBoss() {
    const head = this.snake[0];
    let x = 0;
    let y = 0;
    // re-roll the angle so the boss never materializes inside rubble
    for (let k = 0; k < 10; k++) {
      const a = this.rng() * Math.PI * 2;
      const dist = BOSS_SPAWN_MIN + this.rng() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
      x = this.clamp(head.x + Math.cos(a) * dist, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE);
      y = this.clamp(head.y + Math.sin(a) * dist, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE);
      if (!this.isBlocked(x, y)) break;
    }
    const S = Math.max(1, this.score);
    const hp = BOSS_HP_PER_SCORE * S;
    this.boss = {
      id: this.combatId++,
      pos: { x, y },
      hp,
      maxHp: hp,
      anchorScore: S,
      phase: 1,
      telegraph: BOSS_TELEGRAPH,
      fireCooldown: BOSS_P1_INTERVAL,
      aimedCooldown: BOSS_P3_AIMED_INTERVAL,
      specialCooldown: BOSS_P3_SPECIAL_INTERVAL,
      summonCooldown: MINION_SUMMON_INTERVAL,
      moveTarget: null,
      retargetTimer: 0,
      hitCooldown: 0,
      slowTimer: 0,
    };
    this.fx({ type: 'bossSpawn', pos: { x, y }, color: '#FF5365', count: 30, text: 'BOSS 出现!', big: true });
  }

  private tickCombat(dt: number) {
    this.checkBossSpawn();
    this.tickAmbientSpawns(dt);
    this.tickBoss(dt);
    this.tickBullets(dt);
    if (this.phase !== 'playing') return;
    this.tickMinions(dt);
    if (this.phase !== 'playing') return;
    this.tickPlayerShots(dt);
    if (this.overloadShieldCd > 0) this.overloadShieldCd -= dt;
    if (this.hasEffect('overload') && this.overloadShieldCd <= 0) {
      this.addShields(1);
      this.overloadShieldCd = OVERLOAD_SHIELD_COOLDOWN;
    }
    this.tickAttack(dt);
    this.tickPoison(dt);
  }

  private tickBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    if (b.telegraph > 0) {
      b.telegraph -= dt;
      return;
    }
    const frac = b.hp / b.maxHp;
    b.phase = frac > BOSS_PHASE2_FRAC ? 1 : frac > BOSS_PHASE3_FRAC ? 2 : 3;
    if (b.slowTimer > 0) b.slowTimer -= dt;
    let rate = this.hasEffect('superconduct') ? 1 - SUPERCONDUCT_BOSS_SLOW : 1;
    if (b.slowTimer > 0) rate *= FREEZE_FIRE_MULT; // blue-bolt freeze slows the boss's triggers
    b.fireCooldown -= dt * rate;
    b.aimedCooldown -= dt * rate;
    b.specialCooldown -= dt * rate;
    b.summonCooldown -= dt;
    const head = this.snake[0];
    const S = b.anchorScore;
    if (b.phase === 1) {
      if (b.fireCooldown <= 0) {
        b.fireCooldown = BOSS_P1_INTERVAL;
        this.aimedShot(b, head, BOSS_P1_DMG * S, 1, 0, '#FF5365', false);
      }
    } else if (b.phase === 2) {
      if (b.fireCooldown <= 0) {
        b.fireCooldown = BOSS_P2_INTERVAL;
        this.aimedShot(b, head, BOSS_P2_DMG * S, BOSS_P2_SPREAD, 0.22, '#FF9A3D', false);
      }
      if (b.summonCooldown <= 0) {
        b.summonCooldown = MINION_SUMMON_INTERVAL;
        this.summonMinions(b);
      }
    } else {
      if (b.fireCooldown <= 0) {
        b.fireCooldown = BOSS_P3_RING_INTERVAL;
        this.ringShot(b, S);
      }
      if (b.aimedCooldown <= 0) {
        b.aimedCooldown = BOSS_P3_AIMED_INTERVAL;
        this.aimedShot(b, head, BOSS_P3_AIMED_DMG * S, 1, 0, '#C43A52', false);
      }
      if (b.specialCooldown <= 0) {
        b.specialCooldown = BOSS_P3_SPECIAL_INTERVAL;
        this.aimedShot(b, head, BOSS_P3_SPECIAL_DMG * S, 1, 0, '#B176FF', true);
      }
    }

    this.moveBoss(b, dt);
    // body contact: shoves and damages the head like a minion ram, on cooldown
    if (b.hitCooldown > 0) b.hitCooldown -= dt;
    const dh = Math.hypot(head.x - b.pos.x, head.y - b.pos.y);
    if (dh < BOSS_HIT_RADIUS && b.hitCooldown <= 0 && this.invuln <= 0) {
      b.hitCooldown = BOSS_CONTACT_COOLDOWN;
      this.applyDamageToSnake(BOSS_CONTACT_DMG * b.anchorScore, false);
      if (this.phase === 'playing') {
        const nx = (head.x - b.pos.x) / (dh || 1);
        const ny = (head.y - b.pos.y) / (dh || 1);
        const tx = this.clamp(head.x + nx * MINION_KNOCKBACK, -WALL_MARGIN + 0.05, GRID - WALL_MARGIN - 0.05);
        const ty = this.clamp(head.y + ny * MINION_KNOCKBACK, -WALL_MARGIN + 0.05, GRID - WALL_MARGIN - 0.05);
        if (!this.isBlocked(tx, ty)) {
          head.x = tx;
          head.y = ty;
          this.path.unshift({ x: head.x, y: head.y });
        }
        this.steerLock = Math.max(this.steerLock, MINION_STEER_LOCK);
      }
    }
  }

  /** Wander along an engagement ring around the head: re-anchor periodically, wobble laterally. */
  private moveBoss(b: BossState, dt: number) {
    const head = this.snake[0];
    if (b.retargetTimer > 0) b.retargetTimer -= dt;
    // no target + timer running → hold position (brief pause between wander legs)
    if (!b.moveTarget && b.retargetTimer > 0) return;
    if (!b.moveTarget || b.retargetTimer <= 0) {
      b.retargetTimer = BOSS_RETARGET_MIN + this.rng() * (BOSS_RETARGET_MAX - BOSS_RETARGET_MIN);
      for (let k = 0; k < 8; k++) {
        const a = this.rng() * Math.PI * 2;
        const r = BOSS_ENGAGE_MIN + this.rng() * (BOSS_ENGAGE_MAX - BOSS_ENGAGE_MIN);
        const cand = {
          x: this.clamp(head.x + Math.cos(a) * r, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE),
          y: this.clamp(head.y + Math.sin(a) * r, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE),
        };
        if (!this.isBlocked(cand.x, cand.y)) {
          b.moveTarget = cand;
          break;
        }
      }
      if (!b.moveTarget) return; // ring fully obstructed this tick — retry next time
    }
    const dx = b.moveTarget.x - b.pos.x;
    const dy = b.moveTarget.y - b.pos.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.4) {
      b.moveTarget = null; // anchor reached — pause briefly, then pick a fresh one
      b.retargetTimer = Math.min(b.retargetTimer, 0.4);
      return;
    }
    const sp = this.speed() * BOSS_SPEED_FRAC * (b.slowTimer > 0 ? FREEZE_MOVE_MULT : 1);
    const wob = Math.sin(this.elapsed * 1.7 + b.id * 2.3) * BOSS_WOBBLE;
    const nx = this.clamp(b.pos.x + (dx / len + (-dy / len) * wob) * sp * dt, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE);
    const ny = this.clamp(b.pos.y + (dy / len + (dx / len) * wob) * sp * dt, BOSS_SPAWN_EDGE, GRID - BOSS_SPAWN_EDGE);
    if (this.isBlocked(nx, ny)) {
      // rubble in the way — abandon this leg and re-anchor after a short pause
      b.moveTarget = null;
      b.retargetTimer = Math.min(b.retargetTimer, 0.5);
      return;
    }
    b.pos.x = nx;
    b.pos.y = ny;
  }

  /** Wild minions between boss fights: spawn off-view on a timer, respect the shared cap. */
  private tickAmbientSpawns(dt: number) {
    if (this.phase !== 'playing') return;
    if (this.boss) return; // boss fights get the map to themselves
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = AMBIENT_INTERVAL_MIN + this.rng() * (AMBIENT_INTERVAL_MAX - AMBIENT_INTERVAL_MIN);
    if (this.minions.length >= MINION_CAP) return;
    const head = this.snake[0];
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * Math.PI * 2;
      const dist = AMBIENT_SPAWN_MIN + this.rng() * (AMBIENT_SPAWN_MAX - AMBIENT_SPAWN_MIN);
      const x = head.x + Math.cos(a) * dist;
      const y = head.y + Math.sin(a) * dist;
      if (x < 1 || x > GRID - 1 || y < 1 || y > GRID - 1 || this.isBlocked(x, y)) continue;
      const S = Math.max(1, this.score);
      const hp = MINION_HP_FRAC * S;
      this.minions.push({ id: this.combatId++, pos: { x, y }, hp, maxHp: hp, anchorScore: S, hitCooldown: 0, ambient: true, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 });
      this.fx({ type: 'minionSpawn', pos: { x, y }, color: '#FF9A3D', count: 10 });
      break;
    }
  }

  private aimedShot(b: BossState, target: Vec, dmg: number, count: number, spread: number, color: string, special: boolean) {
    const base = Math.atan2(target.y - b.pos.y, target.x - b.pos.x);
    const speed = this.bulletSpeed();
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = base + off;
      this.spawnBullet(b.pos, Math.cos(a), Math.sin(a), speed, dmg, special, color);
    }
    this.fx({ type: 'bossShoot', pos: { x: b.pos.x, y: b.pos.y }, color, count: 6 });
  }

  private ringShot(b: BossState, S: number) {
    const speed = this.bulletSpeed();
    const gaps = new Set<number>();
    while (gaps.size < BOSS_P3_RING_GAPS) gaps.add(Math.floor(this.rng() * BOSS_P3_RING_COUNT));
    const rot = this.rng() * Math.PI * 2;
    for (let i = 0; i < BOSS_P3_RING_COUNT; i++) {
      if (gaps.has(i)) continue;
      const a = rot + (i / BOSS_P3_RING_COUNT) * Math.PI * 2;
      this.spawnBullet(b.pos, Math.cos(a), Math.sin(a), speed, BOSS_P3_RING_DMG * S, false, '#FF7030');
    }
    this.fx({ type: 'bossShoot', pos: { x: b.pos.x, y: b.pos.y }, color: '#FF7030', count: 16 });
  }

  private spawnBullet(pos: Vec, dx: number, dy: number, speed: number, dmg: number, special: boolean, color: string) {
    const len = Math.hypot(dx, dy) || 1;
    this.bullets.push({
      id: this.combatId++,
      pos: { x: pos.x, y: pos.y },
      vel: { x: (dx / len) * speed, y: (dy / len) * speed },
      dmg,
      radius: BULLET_RADIUS,
      color,
      special,
      muzzle: BULLET_MUZZLE,
      life: BULLET_LIFE,
    });
  }

  private tickBullets(dt: number) {
    const head = this.snake[0];
    for (const bl of this.bullets) {
      if (bl.muzzle > 0) {
        bl.muzzle -= dt;
        continue;
      }
      bl.pos.x += bl.vel.x * dt;
      bl.pos.y += bl.vel.y * dt;
      bl.life -= dt;
      if (this.isBlocked(bl.pos.x, bl.pos.y)) bl.life = -1; // rubble stops bullets — cover
    }
    this.bullets = this.bullets.filter(
      (bl) => bl.life > 0 && bl.pos.x >= -1 && bl.pos.x <= GRID + 1 && bl.pos.y >= -1 && bl.pos.y <= GRID + 1,
    );
    for (const bl of this.bullets) {
      if (bl.muzzle > 0) continue;
      if (Math.hypot(head.x - bl.pos.x, head.y - bl.pos.y) < bl.radius + 0.15) {
        bl.life = -1;
        this.applyDamageToSnake(bl.dmg, bl.special);
        if (this.phase !== 'playing') break;
      }
    }
    this.bullets = this.bullets.filter((bl) => bl.life > 0);
  }

  private summonMinions(b: BossState) {
    const room = MINION_CAP - this.minions.length;
    if (room <= 0) return;
    const n = Math.min(room, 1 + Math.floor(this.rng() * MINION_PER_SUMMON));
    for (let i = 0; i < n; i++) {
      let pos: Vec | null = null;
      for (let k = 0; k < 8; k++) {
        const a = this.rng() * Math.PI * 2;
        const cand = {
          x: this.clamp(b.pos.x + Math.cos(a) * MINION_SPAWN_OFFSET, 1, GRID - 1),
          y: this.clamp(b.pos.y + Math.sin(a) * MINION_SPAWN_OFFSET, 1, GRID - 1),
        };
        if (!this.isBlocked(cand.x, cand.y)) {
          pos = cand;
          break;
        }
      }
      if (!pos) continue;
      const hp = MINION_HP_FRAC * b.anchorScore;
      this.minions.push({ id: this.combatId++, pos, hp, maxHp: hp, anchorScore: b.anchorScore, hitCooldown: 0, ambient: false, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 });
      this.fx({ type: 'minionSpawn', pos, color: '#FF9A3D', count: 12 });
    }
  }

  private tickMinions(dt: number) {
    const head = this.snake[0];
    const sp = this.speed() * MINION_SPEED_FRAC;
    for (const m of this.minions) {
      if (m.hitCooldown > 0) m.hitCooldown -= dt;
      if (m.slowTimer > 0) m.slowTimer -= dt;
      const msp = sp * (m.slowTimer > 0 ? FREEZE_MOVE_MULT : 1);
      const dx = head.x - m.pos.x;
      const dy = head.y - m.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len;
      let uy = dy / len;
      // steer around rubble: slide tangentially when the cell ahead is blocked
      if (this.isBlocked(m.pos.x + ux * 0.9, m.pos.y + uy * 0.9)) {
        const side = m.id % 2 === 0 ? 1 : -1;
        const tx = -uy * side;
        const ty = ux * side;
        if (!this.isBlocked(m.pos.x + tx * 0.9, m.pos.y + ty * 0.9)) {
          ux = tx;
          uy = ty;
        } else {
          ux = -tx;
          uy = -ty;
        }
      }
      const mx = m.pos.x + ux * msp * dt;
      const my = m.pos.y + uy * msp * dt;
      if (!this.isBlocked(mx, my)) {
        m.pos.x = mx;
        m.pos.y = my;
      }
      if (len < MINION_HIT_RADIUS && m.hitCooldown <= 0 && this.invuln <= 0) {
        m.hitCooldown = 0.6;
        this.applyDamageToSnake(MINION_RAM_DMG * m.anchorScore, false);
        if (this.phase === 'playing') {
          const kx = (dx / len) * MINION_KNOCKBACK;
          const ky = (dy / len) * MINION_KNOCKBACK;
          const hx = this.clamp(head.x + kx, -WALL_MARGIN + 0.05, GRID - WALL_MARGIN - 0.05);
          const hy = this.clamp(head.y + ky, -WALL_MARGIN + 0.05, GRID - WALL_MARGIN - 0.05);
          // never shove the head into rubble — displacement is skipped, the stun still lands
          if (!this.isBlocked(hx, hy)) {
            head.x = hx;
            head.y = hy;
            this.path.unshift({ x: head.x, y: head.y });
          }
          this.steerLock = Math.max(this.steerLock, MINION_STEER_LOCK);
        }
      }
    }
    this.minions = this.minions.filter((m) => m.hp > 0);
  }

  /** The enemy nearest to the snake head within ATTACK_LOCK_RANGE; null → bolts fly straight. */
  private lockTarget(): { id: number; pos: Vec } | null {
    const head = this.snake[0];
    let best: { id: number; pos: Vec } | null = null;
    let bd = ATTACK_LOCK_RANGE;
    if (this.boss && this.boss.telegraph <= 0) {
      const d = Math.hypot(this.boss.pos.x - head.x, this.boss.pos.y - head.y);
      if (d < bd) {
        bd = d;
        best = { id: this.boss.id, pos: this.boss.pos };
      }
    }
    for (const m of this.minions) {
      const d = Math.hypot(m.pos.x - head.x, m.pos.y - head.y);
      if (d < bd) {
        bd = d;
        best = { id: m.id, pos: m.pos };
      }
    }
    return best;
  }

  /** Live position of a locked target; null once it dies or (for the boss) re-enters telegraph. */
  private targetPos(id: number): Vec | null {
    if (this.boss && this.boss.id === id && this.boss.telegraph <= 0) return this.boss.pos;
    for (const m of this.minions) if (m.id === id && m.hp > 0) return m.pos;
    return null;
  }

  private tickPlayerShots(dt: number) {
    for (const p of this.playerShots) {
      if (p.homing && p.targetId !== null) {
        const t = this.targetPos(p.targetId);
        if (t) {
          const dx = t.x - p.pos.x;
          const dy = t.y - p.pos.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = Math.hypot(p.vel.x, p.vel.y);
          p.vel.x = (dx / len) * sp;
          p.vel.y = (dy / len) * sp;
        }
      }
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt;
      if (this.isBlocked(p.pos.x, p.pos.y)) {
        p.life = -1;
        continue;
      }
      if (this.boss && this.boss.telegraph <= 0 && Math.hypot(p.pos.x - this.boss.pos.x, p.pos.y - this.boss.pos.y) < p.radius + 1.3) {
        if (p.effect === 'slow') this.boss.slowTimer = FREEZE_DURATION;
        if (p.effect === 'poison') this.applyPoisonBoss();
        this.damageBoss(p.dmg);
        if (this.hasEffect('charged')) this.lightningChain(p.dmg);
        p.life = -1;
        this.fx({ type: 'bossHit', pos: { x: p.pos.x, y: p.pos.y }, color: p.color, count: 6 });
        continue;
      }
      for (const m of this.minions) {
        if (Math.hypot(p.pos.x - m.pos.x, p.pos.y - m.pos.y) < p.radius + 0.5) {
          if (p.effect === 'slow') m.slowTimer = FREEZE_DURATION;
          if (p.effect === 'poison') {
            m.poisonStacks = Math.min(POISON_MAX_STACKS, m.poisonStacks + 1);
            m.poisonTimer = POISON_DURATION;
          }
          this.damageMinion(m, p.dmg, p.effect === 'poison');
          if (this.hasEffect('charged')) this.lightningChain(p.dmg);
          p.life = -1;
          break;
        }
      }
    }
    this.playerShots = this.playerShots.filter(
      (p) => p.life > 0 && p.pos.x >= -2 && p.pos.x <= GRID + 2 && p.pos.y >= -2 && p.pos.y <= GRID + 2,
    );
  }

  private damageBoss(dmg: number) {
    const b = this.boss;
    if (!b || b.telegraph > 0) return;
    b.hp -= dmg;
    if (b.hp <= 0) this.killBoss();
  }

  private damageMinion(m: MinionState, dmg: number, byPoison = false) {
    m.hp -= dmg;
    if (m.hp <= 0) {
      this.score += Math.round(MINION_KILL_SCORE_FRAC * m.anchorScore);
      if (byPoison) {
        // poison kill refunds a little score on top of the normal kill credit
        const heal = Math.round(POISON_KILL_HEAL_FRAC * m.anchorScore);
        if (heal > 0) {
          this.score += heal;
          this.fx({ type: 'playerShoot', pos: { x: m.pos.x, y: m.pos.y }, color: '#4EF1A3', count: 6, text: `+${heal}` });
        }
      }
      if (m.ambient) this.spawnBean(GENE_LIST[Math.floor(this.rng() * 3)]);
      this.fx({ type: 'minionDeath', pos: { x: m.pos.x, y: m.pos.y }, color: '#FF9A3D', count: 14 });
    }
  }

  private killBoss() {
    const b = this.boss;
    if (!b) return;
    this.boss = null;
    this.bullets = [];
    this.minions = [];
    this.poisonStacks = 0;
    this.poisonTimer = 0;
    this.stats.bossesKilled++;
    const reward = Math.round(BOSS_KILL_SCORE_FRAC * b.anchorScore);
    this.score += reward;
    this.fx({ type: 'bossDeath', pos: { x: b.pos.x, y: b.pos.y }, color: '#FFC857', count: 40, text: `击杀 +${reward}`, big: true });
    for (let i = 0; i < BOSS_GENE_DROPS; i++) this.spawnBean(GENE_LIST[Math.floor(this.rng() * 3)]);
    if (this.rng() < BOSS_CROWN_CHANCE) this.spawnBean('crown');
  }

  /** Full damage pipeline: i-frames → ghost dodge → shield → score deduction → 0-score fatal. */
  private applyDamageToSnake(dmg: number, special: boolean) {
    if (this.invuln > 0 || this.phase !== 'playing') return;
    const head = this.snake[0];
    // ghost dodge (blue 5-chain): 30% chance to phase through any hit
    if (this.hasEffect('ghost') && this.rng() < 0.3) {
      this.invuln = 0.4;
      this.fx({ type: 'playerHit', pos: { x: head.x, y: head.y }, color: '#8FB8FF', count: 10, text: '幽体闪避' });
      return;
    }
    // a shield blocks the entire hit
    if (this.shields > 0) {
      this.shields--;
      this.invuln = HIT_INVULN;
      this.fx({ type: 'shieldBreak', pos: { x: head.x, y: head.y }, color: '#43BFFF', count: 22 });
      return;
    }
    const fatal = this.score <= 0;
    const loss = Math.round(dmg);
    this.score = Math.max(0, this.score - loss);
    this.chain = { color: null, count: 0 };
    this.invuln = HIT_INVULN;
    this.fx({ type: 'playerHit', pos: { x: head.x, y: head.y }, color: '#FF5365', count: 18, text: `-${loss}`, big: true });
    if (special) this.addEffect('weak');
    if (fatal) this.handleFatal('score', head);
  }

  // ---------- player attack ----------
  /** Left mouse button only toggles the attack; the aim always follows the head's heading. */
  setAttack(active: boolean) {
    this.attackActive = active;
  }

  attackFormInfo(): { form: AttackForm; stage: number } {
    if (this.morph.prism) return { form: 'prism', stage: Math.max(1, morphSummary(this.morph).stage) };
    const s = morphSummary(this.morph);
    if (s.stage === 0 || s.races.length === 0) return { form: 'none', stage: 0 };
    const race = s.races[0];
    return { form: race, stage: this.clamp(this.morph.tiers[race], 1, 3) };
  }

  private attackMultiplier(): number {
    const { form, stage } = this.attackFormInfo();
    const idx = this.clamp(stage - 1, 0, 2);
    let base = 1.0;
    if (form === 'red') base = ATTACK_FORM_MULT.red[idx];
    else if (form === 'blue') base = ATTACK_FORM_MULT.blue[idx];
    else if (form === 'green') base = ATTACK_FORM_MULT.green[idx];
    else if (form === 'prism') base = PRISM_ATTACK_MULT;
    let amp = 1;
    for (const k of Object.keys(ELEMENT_ATTACK_AMP) as TimedEffect['kind'][]) {
      if (this.hasEffect(k)) amp *= ELEMENT_ATTACK_AMP[k] ?? 1;
    }
    if (this.activeEvent?.kind === 'goldenTime') amp *= GOLDEN_TIME_ATTACK_MULT;
    amp = Math.min(amp, ATTACK_CAP_MULT);
    return base * amp;
  }

  private tickAttack(dt: number) {
    if (!this.attackActive || this.phase !== 'playing') return;
    const { form } = this.attackFormInfo();
    const mult = this.attackMultiplier();
    const S = this.boss?.anchorScore ?? this.minions[0]?.anchorScore ?? Math.max(1, this.peakScore);
    this.attackCooldown -= dt;
    if (this.attackCooldown > 0) return;
    if (form === 'none') {
      // plain straight energy bolt — no lock, pure aim
      this.attackCooldown = ATTACK_BOLT_INTERVAL;
      this.fireBolt({ dmg: ATTACK_BOLT_DMG * S * mult, speed: ATTACK_BOLT_SPEED, radius: 0.35, color: '#BFE6FF' });
    } else if (form === 'red') {
      // heavy homing shell: slow cadence, big body, high damage
      this.attackCooldown = RED_SHOT_INTERVAL;
      this.fireBolt({
        dmg: ATTACK_BASE_DPS * RED_SHOT_INTERVAL * RED_DMG_MULT * S * mult,
        speed: RED_SHOT_SPEED,
        radius: RED_SHOT_RADIUS,
        color: '#FF5365',
        lock: true,
      });
    } else if (form === 'blue') {
      // rapid small homing bolts; each hit refreshes the freeze slow
      this.attackCooldown = BLUE_SHOT_INTERVAL;
      this.fireBolt({
        dmg: ATTACK_BASE_DPS * BLUE_SHOT_INTERVAL * BLUE_DMG_MULT * S * mult,
        speed: BLUE_SHOT_SPEED,
        radius: BLUE_SHOT_RADIUS,
        color: '#43BFFF',
        effect: 'slow',
        lock: true,
      });
    } else if (form === 'green') {
      // medium homing bolts that stack a poison DoT; poison kills refund a little score
      this.attackCooldown = GREEN_SHOT_INTERVAL;
      this.fireBolt({
        dmg: ATTACK_BASE_DPS * GREEN_SHOT_INTERVAL * GREEN_DMG_MULT * S * mult,
        speed: GREEN_SHOT_SPEED,
        radius: GREEN_SHOT_RADIUS,
        color: '#4EF1A3',
        effect: 'poison',
        lock: true,
      });
    } else if (form === 'prism') {
      // twin homing rainbow columns — both bolts share the same lock
      this.attackCooldown = PRISM_SHOT_INTERVAL;
      const dmg = ATTACK_BASE_DPS * PRISM_SHOT_INTERVAL * S * mult * PRISM_DMG_FRAC;
      const target = this.lockTarget();
      this.fireBolt({ dmg, speed: PRISM_BULLET_SPEED, radius: 0.35, color: 'rainbow', lateral: -PRISM_COLUMN_OFFSET, silent: true, target });
      this.fireBolt({ dmg, speed: PRISM_BULLET_SPEED, radius: 0.35, color: 'rainbow', lateral: PRISM_COLUMN_OFFSET, silent: true, target });
      const head = this.snake[0];
      const hue = (this.combatId * 47) % 360;
      this.fx({ type: 'playerShoot', pos: { x: head.x, y: head.y }, color: `hsl(${hue}, 95%, 65%)`, count: 3 });
    }
  }

  /** Spawn one player bolt. `lock` locks onto the nearest enemy in range; `target` overrides the lock. */
  private fireBolt(opts: {
    dmg: number;
    speed: number;
    radius: number;
    color: string;
    effect?: 'slow' | 'poison';
    lock?: boolean;
    target?: { id: number; pos: Vec } | null;
    lateral?: number;
    silent?: boolean;
  }) {
    const head = this.snake[0];
    const lateral = opts.lateral ?? 0;
    const target = opts.target !== undefined ? opts.target : opts.lock ? this.lockTarget() : null;
    this.playerShots.push({
      id: this.combatId++,
      pos: { x: head.x - this.aimY * lateral, y: head.y + this.aimX * lateral },
      vel: { x: this.aimX * opts.speed, y: this.aimY * opts.speed },
      dmg: opts.dmg,
      radius: opts.radius,
      color: opts.color,
      homing: target !== null,
      targetId: target ? target.id : null,
      effect: opts.effect ?? 'none',
      life: 1.4,
    });
    if (!opts.silent) this.fx({ type: 'playerShoot', pos: { x: head.x, y: head.y }, color: opts.color, count: 4 });
  }

  private lightningChain(dmg: number) {
    const head = this.snake[0];
    const zap = dmg * CHAIN_LIGHTNING_FALLOFF;
    for (const m of this.minions) {
      if (Math.hypot(m.pos.x - head.x, m.pos.y - head.y) <= CHAIN_LIGHTNING_RANGE) this.damageMinion(m, zap);
    }
    if (this.boss && this.boss.telegraph <= 0 && Math.hypot(this.boss.pos.x - head.x, this.boss.pos.y - head.y) <= CHAIN_LIGHTNING_RANGE) {
      this.damageBoss(zap);
    }
    this.fx({ type: 'playerShoot', pos: { x: head.x, y: head.y }, color: '#FFE066', count: 10, text: '雷链' });
  }

  /** Poison stacks currently on the active boss (for the renderer's toxic tint). */
  get bossPoisonStacks(): number {
    return this.poisonStacks;
  }

  private applyPoisonBoss() {
    this.poisonStacks = Math.min(POISON_MAX_STACKS, this.poisonStacks + 1);
    this.poisonTimer = POISON_DURATION;
  }

  private tickPoison(dt: number) {
    if (!this.boss) {
      this.poisonStacks = 0;
      this.poisonTimer = 0;
    } else if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      if (this.poisonStacks > 0) this.damageBoss(POISON_DPS_PER_SEC * this.boss.anchorScore * this.poisonStacks * dt);
    } else {
      this.poisonStacks = 0;
    }
    for (const m of this.minions) {
      if (m.poisonTimer > 0) {
        m.poisonTimer -= dt;
        if (m.poisonStacks > 0) this.damageMinion(m, POISON_DPS_PER_SEC * m.anchorScore * m.poisonStacks * dt, true);
      } else {
        m.poisonStacks = 0;
      }
    }
  }

  // ---------- snapshot ----------
  getHud(): HudState {
    const stats: RunStats = {
      score: this.score,
      maxChain: this.stats.maxChain,
      maxLength: this.stats.maxLength,
      evolutions: this.stats.evolutions,
      timeAlive: this.elapsed,
      bossesKilled: this.stats.bossesKilled,
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
      morph: { tiers: { ...this.morph.tiers }, prism: this.morph.prism },
      boss: this.boss
        ? { hp: this.boss.hp, maxHp: this.boss.maxHp, phase: this.boss.phase, anchorScore: this.boss.anchorScore }
        : null,
      nextBossAt: BOSS_STEP * (this.bossIndex + 1),
      attackForm: this.attackFormInfo().form,
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
