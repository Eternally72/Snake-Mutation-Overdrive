import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import {
  ATTACK_BASE_DPS,
  ATTACK_FORM_MULT,
  ATTACK_LOCK_RANGE,
  BLUE_SHOT_INTERVAL,
  GRID,
  MIN_SNAKE_LENGTH,
  MINION_KILL_SCORE_FRAC,
  POISON_KILL_HEAL_FRAC,
  POISON_MAX_STACKS,
  PRISM_BULLET_SPEED,
  PRISM_COLUMN_OFFSET,
  RED_DMG_MULT,
  RED_SHOT_INTERVAL,
  RED_SHOT_RADIUS,
  upgradeThreshold,
} from '../src/game/config';

function makeEngine(seed = 42) {
  return new GameEngine(seed);
}

/** Advance the engine by simulating n grid steps with a large dt budget. */
function steps(engine: GameEngine, n: number) {
  for (let i = 0; i < n; i++) {
    engine.update(1 / engine.speed() + 0.0001);
    if (engine.phase !== 'playing') break;
  }
}

/** One step, dismissing any upgrade modal that pops up. */
function stepSkipUpgrade(engine: GameEngine) {
  steps(engine, 1);
  if (engine.phase === 'upgrade') engine.skipUpgrade();
}

/** Advance the engine by `seconds` of sim time in fine substeps. */
function advance(engine: GameEngine, seconds: number, dt = 1 / 120) {
  let t = 0;
  while (t < seconds && engine.phase === 'playing') {
    engine.update(dt);
    t += dt;
  }
}

/** Steer perpendicular to heading every frame → tightest left circle. */
function circle(engine: GameEngine, seconds: number, dt = 1 / 120) {
  let t = 0;
  while (t < seconds && engine.phase === 'playing') {
    engine.setSteer(Math.cos(engine.heading - Math.PI / 2), Math.sin(engine.heading - Math.PI / 2));
    engine.update(dt);
    t += dt;
  }
}

/** Feed red beans straight ahead to grow the snake (skips upgrade modals). */
function growLong(engine: GameEngine, n: number) {
  for (let i = 0; i < n && engine.phase !== 'dead'; i++) {
    const head = engine.snake[0];
    engine.beans.length = 0;
    engine.beans.push({ id: 40000 + i, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
    advance(engine, 1 / engine.speed());
    if (engine.phase === 'upgrade') engine.skipUpgrade();
  }
}

describe('基础规则', () => {
  it('蛇持续前进并可自由转向', () => {
    const e = makeEngine();
    const head0 = { ...e.snake[0] };
    advance(e, 1.5 / e.speed());
    expect(e.snake[0].x).toBeGreaterThan(head0.x + 1);
    // steering up rotates the heading so the head starts climbing
    e.setSteer(0, -1);
    advance(e, 1.5 / e.speed());
    expect(e.snake[0].y).toBeLessThan(head0.y);
  });

  it('斜向输入产生 45° 平滑转向', () => {
    const e = makeEngine();
    e.setSteer(1, -1); // right + up = up-right diagonal
    advance(e, 0.5);
    expect(e.heading).toBeCloseTo(-Math.PI / 4, 1);
  });

  it('撞墙死亡', () => {
    const e = makeEngine();
    e.beans.length = 0;
    // place the snake at the right edge facing the wall
    const y = e.snake[0].y;
    e.snake = [
      { x: GRID - 1, y, color: 'green' },
      { x: GRID - 2, y, color: 'green' },
      { x: GRID - 3, y, color: 'green' },
    ];
    e.prevSnake = e.snake.map((s) => ({ x: s.x, y: s.y }));
    e.dir = 'right';
    steps(e, 1);
    expect(e.phase).toBe('dead');
  });

  it('吃豆增长且豆子不在蛇身上', () => {
    const e = makeEngine(7);
    const len0 = e.snake.length;
    // place a bean directly in front of the head
    const head = e.snake[0];
    e.beans.length = 0;
    e.beans.push({ id: 999, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
    steps(e, 1);
    expect(e.score).toBeGreaterThan(0);
    // growth applies on the following step
    steps(e, 1);
    expect(e.snake.length).toBe(len0 + 1);
    for (const b of e.beans) {
      expect(e.snake.some((s) => s.x === b.pos.x && s.y === b.pos.y)).toBe(false);
    }
  });

  it('绕圈撞到自己身体死亡', () => {
    const e = makeEngine(5);
    growLong(e, 22);
    e.effects.length = 0; // drop speed buffs so the turn circle stays tight
    expect(e.snake.length).toBeGreaterThanOrEqual(15);
    circle(e, 8); // keep turning left until the head bites into its own coil
    expect(e.phase).toBe('dead');
  });

  it('直行时不会误判自撞', () => {
    const e = makeEngine();
    e.beans.length = 0;
    advance(e, 1.5); // travel straight for a while
    expect(e.phase).toBe('playing');
  });
});

describe('基因连锁', () => {
  function feedColor(e: GameEngine, color: 'red' | 'blue' | 'green', n: number) {
    for (let i = 0; i < n; i++) {
      const head = e.snake[0];
      const dir = e.dir === 'right' ? { x: 1, y: 0 } : { x: 0, y: 1 };
      e.beans.length = 0;
      const pos = { x: head.x + dir.x, y: head.y + dir.y };
      if (pos.x >= GRID || pos.y >= GRID) return;
      e.beans.push({ id: 5000 + i, kind: color, pos, born: 0 });
      steps(e, 1);
      if (e.phase !== 'playing') return;
    }
  }

  it('同色连吃提升连锁等级至上限 5', () => {
    const e = makeEngine(3);
    feedColor(e, 'red', 6);
    expect(e.chain.color).toBe('red');
    expect(e.chain.count).toBe(5);
  });

  it('异色打断连锁并重置为 1', () => {
    const e = makeEngine(3);
    feedColor(e, 'red', 2);
    expect(e.chain.count).toBe(2);
    feedColor(e, 'blue', 1);
    expect(e.chain.color).toBe('blue');
    expect(e.chain.count).toBe(1);
  });

  it('技能豆不打断连锁', () => {
    const e = makeEngine(3);
    feedColor(e, 'red', 2);
    const head = e.snake[0];
    e.beans.length = 0;
    e.beans.push({ id: 7777, kind: 'skill', pos: { x: head.x + 1, y: head.y }, born: 0 });
    steps(e, 1);
    expect(e.chain.color).toBe('red');
    expect(e.chain.count).toBe(2);
    expect(e.skill).not.toBeNull();
  });

  it('三连触发变异，五连触发完全进化', () => {
    const e = makeEngine(3);
    feedColor(e, 'red', 3);
    expect(e.hasEffect('burn')).toBe(true);
    feedColor(e, 'red', 2);
    expect(e.hasEffect('flame')).toBe(true);
    expect(e.stats.evolutions).toBe(1);
  });

  it('蓝色三连获得护盾', () => {
    const e = makeEngine(3);
    feedColor(e, 'blue', 3);
    expect(e.shields).toBeGreaterThanOrEqual(1);
  });

  it('护盾将自身碰撞截断而非死亡', () => {
    const e = makeEngine(3);
    growLong(e, 22);
    e.effects.length = 0; // drop speed buffs so the turn circle stays tight
    e.shields = 6;
    circle(e, 3); // first self-contact spends a shield and truncates the tail
    expect(e.phase).toBe('playing');
    expect(e.shields).toBeLessThan(6);
    // body has no duplicates
    const keys = e.snake.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('分数不会出现 NaN / Infinity / 负值', () => {
    const e = makeEngine(11);
    for (let i = 0; i < 300 && e.phase === 'playing'; i++) {
      e.update(0.05);
      expect(Number.isFinite(e.score)).toBe(true);
      expect(e.score).toBeGreaterThanOrEqual(0);
      // keep it alive by turning before walls
      const head = e.snake[0];
      if (head.x > GRID - 4 && e.dir === 'right') e.enqueueDir('down');
      if (head.y > GRID - 4 && e.dir === 'down') e.enqueueDir('left');
      if (head.x < 3 && e.dir === 'left') e.enqueueDir('up');
      if (head.y < 3 && e.dir === 'up') e.enqueueDir('right');
    }
  });
});

describe('豆子生成', () => {
  it('三色基因豆始终至少各一颗', () => {
    const e = makeEngine(5);
    for (let i = 0; i < 60 && e.phase === 'playing'; i++) {
      e.update(0.1);
      for (const c of ['red', 'blue', 'green'] as const) {
        expect(e.beans.some((b) => b.kind === c)).toBe(true);
      }
      const head = e.snake[0];
      if (head.x > GRID - 4 && e.dir === 'right') e.enqueueDir('down');
      if (head.y > GRID - 4 && e.dir === 'down') e.enqueueDir('left');
      if (head.x < 3 && e.dir === 'left') e.enqueueDir('up');
      if (head.y < 3 && e.dir === 'up') e.enqueueDir('right');
    }
  });

  it('豆子不重叠且不在蛇身内', () => {
    const e = makeEngine(9);
    for (let i = 0; i < 120 && e.phase === 'playing'; i++) {
      e.update(0.1);
      const keys = e.beans.map((b) => `${b.pos.x},${b.pos.y}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const b of e.beans) {
        expect(e.snake.some((s) => s.x === b.pos.x && s.y === b.pos.y)).toBe(false);
      }
      const head = e.snake[0];
      if (head.x > GRID - 4 && e.dir === 'right') e.enqueueDir('down');
      if (head.y > GRID - 4 && e.dir === 'down') e.enqueueDir('left');
      if (head.x < 3 && e.dir === 'left') e.enqueueDir('up');
      if (head.y < 3 && e.dir === 'up') e.enqueueDir('right');
    }
  });
});

describe('技能', () => {
  it('冲刺沿当前方向前进且不穿墙', () => {
    const e = makeEngine();
    e.skill = { kind: 'dash', charges: 1 };
    const head0 = { ...e.snake[0] };
    e.beans.length = 0;
    expect(e.useSkill()).toBe(true);
    expect(e.snake[0].x).toBeCloseTo(head0.x + 3, 3);
    expect(e.skill).toBeNull(); // single charge consumed
    // at the wall, dash refuses
    e.skill = { kind: 'dash', charges: 1 };
    e.heading = 0;
    e.snake[0].x = GRID - 0.5;
    expect(e.useSkill()).toBe(false);
    expect(e.skill!.charges).toBe(1);
  });

  it('断尾缩短身体但不低于最小长度，且颜色数据一致', () => {
    const e = makeEngine();
    // grow to 10
    for (let i = 0; i < 7; i++) {
      const head = e.snake[0];
      e.beans.length = 0;
      e.beans.push({ id: 4000 + i, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
      stepSkipUpgrade(e);
      if (e.phase !== 'playing') break;
    }
    expect(e.snake.length).toBeGreaterThanOrEqual(9);
    e.skill = { kind: 'shed', charges: 1 };
    const lenBefore = e.snake.length;
    expect(e.useSkill()).toBe(true);
    expect(e.snake.length).toBeLessThan(lenBefore);
    expect(e.snake.length).toBeGreaterThanOrEqual(MIN_SNAKE_LENGTH);
    for (const s of e.snake) {
      expect(['red', 'blue', 'green']).toContain(s.color);
    }
  });

  it('缓流降低速度', () => {
    const e = makeEngine();
    const v0 = e.speed();
    e.skill = { kind: 'slow', charges: 1 };
    e.useSkill();
    expect(e.speed()).toBeLessThan(v0);
  });

  it('蛇身长度最小时断尾被拒绝', () => {
    const e = makeEngine();
    expect(e.snake.length).toBe(MIN_SNAKE_LENGTH);
    e.skill = { kind: 'shed', charges: 1 };
    expect(e.useSkill()).toBe(false);
    expect(e.skill!.charges).toBe(1);
  });
});

describe('强化系统', () => {
  it('里程碑递增触发三选一，选项不重复', () => {
    const e = makeEngine(13);
    expect(upgradeThreshold(1)).toBeGreaterThan(upgradeThreshold(0));
    e.beans.length = 0;
    e.score = upgradeThreshold(0) - 1;
    const head = e.snake[0];
    e.beans.push({ id: 6001, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
    steps(e, 1);
    expect(e.phase).toBe('upgrade');
    expect(e.upgradeChoices.length).toBe(3);
    expect(new Set(e.upgradeChoices).size).toBe(3);
  });

  it('选择强化后游戏恢复且强化生效', () => {
    const e = makeEngine(13);
    e.triggerUpgradeChoice('crown');
    const choice = e.upgradeChoices[0];
    e.chooseUpgrade(choice);
    expect(e.phase).toBe('playing');
    expect(e.upgradeLevel(choice)).toBe(1);
  });

  it('黄金吞噬提高豆子基础分', () => {
    const e1 = makeEngine(21);
    const e2 = makeEngine(21);
    e2.upgrades.set('goldenGluttony', 3);
    const feed = (e: GameEngine) => {
      const head = e.snake[0];
      e.beans.length = 0;
      e.beans.push({ id: 8001, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
      steps(e, 1);
      return e.score;
    };
    expect(feed(e2)).toBeGreaterThan(feed(e1));
  });

  it('重新开始清空局内状态', () => {
    const e = makeEngine(13);
    e.upgrades.set('chainAmp', 2);
    e.score = 999;
    e.shields = 2;
    e.skill = { kind: 'dash', charges: 2 };
    e.reset(13);
    expect(e.score).toBe(0);
    expect(e.upgrades.size).toBe(0);
    expect(e.shields).toBe(0);
    expect(e.skill).toBeNull();
    expect(e.snake.length).toBe(3);
    expect(e.phase).toBe('playing');
  });

  it('第二生命抵消一次致命碰撞且可恢复', () => {
    const e = makeEngine();
    e.upgrades.set('secondLife', 1);
    e.beans.length = 0;
    // place the snake at the right edge facing the wall
    const y = e.snake[0].y;
    e.snake = [
      { x: GRID - 1, y, color: 'green' },
      { x: GRID - 2, y, color: 'green' },
      { x: GRID - 3, y, color: 'green' },
    ];
    e.prevSnake = e.snake.map((s) => ({ x: s.x, y: s.y }));
    e.dir = 'right';
    steps(e, 1); // walks into the wall → second life freezes it in place
    expect(e.phase).toBe('playing');
    expect(e.secondLifeUsed).toBe(true);
    expect(e.snake[0].x).toBe(GRID - 1);
    // steer down to escape; clear beans each step to keep it deterministic
    const yBefore = e.snake[0].y;
    e.enqueueDir('down');
    for (let i = 0; i < 5 && e.snake[0].x === GRID - 1; i++) {
      e.beans.length = 0;
      steps(e, 1);
    }
    expect(e.phase).toBe('playing');
    expect(e.snake[0].y).toBeGreaterThan(yBefore);
  });
});

describe('暂停', () => {
  it('暂停时逻辑时间停止', () => {
    const e = makeEngine();
    e.pause();
    const head0 = { ...e.snake[0] };
    const score0 = e.score;
    for (let i = 0; i < 10; i++) e.update(0.2);
    expect(e.snake[0]).toEqual(head0);
    expect(e.score).toBe(score0);
    e.resume();
    advance(e, 1 / e.speed());
    expect(e.snake[0].x).toBeCloseTo(head0.x + 1, 1);
  });
});

describe('形态进化（morph）', () => {
  /** Feed n same-color gene beans straight ahead, keeping the chain unbroken. */
  function feedChain(e: GameEngine, color: 'red' | 'blue' | 'green', n: number) {
    for (let i = 0; i < n; i++) {
      const head = e.snake[0];
      e.beans.length = 0;
      e.beans.push({ id: 20000 + i, kind: color, pos: { x: head.x + 1, y: head.y }, born: 0 });
      stepSkipUpgrade(e);
      if (e.phase !== 'playing') return;
    }
  }

  it('红色 5 连进化使红系形态阶级 +1，并同步到 HUD', () => {
    const e = makeEngine(5);
    expect(e.morph.tiers.red).toBe(0);
    feedChain(e, 'red', 5);
    expect(e.morph.tiers.red).toBe(1);
    expect(e.morph.tiers.blue).toBe(0);
    expect(e.morph.tiers.green).toBe(0);
    expect(e.morph.prism).toBe(false);
    const hud = e.getHud();
    expect(hud.morph.tiers.red).toBe(1);
    expect(hud.morph.prism).toBe(false);
  });

  it('两次独立 5 连进化累加阶级（需切换颜色打断连锁）', () => {
    const e = makeEngine(5);
    feedChain(e, 'green', 5);
    expect(e.morph.tiers.green).toBe(1);
    // break the maxed chain with a different color, then rebuild to 5
    feedChain(e, 'red', 1);
    feedChain(e, 'green', 5);
    expect(e.morph.tiers.green).toBe(2);
    expect(e.morph.tiers.red).toBe(0);
  });

  it('连锁封顶后继续吃同色豆不重复增加阶级', () => {
    const e = makeEngine(5);
    feedChain(e, 'red', 5);
    expect(e.morph.tiers.red).toBe(1);
    // chain stays capped at 5; extra red beans must not re-trigger morph
    feedChain(e, 'red', 4);
    expect(e.morph.tiers.red).toBe(1);
  });

  it('reset 清空形态状态', () => {
    const e = makeEngine(5);
    feedChain(e, 'red', 5);
    expect(e.morph.tiers.red).toBe(1);
    e.reset();
    expect(e.morph.tiers).toEqual({ red: 0, blue: 0, green: 0 });
    expect(e.morph.prism).toBe(false);
  });

  it('HUD morph 是深拷贝，外部修改不回灌引擎', () => {
    const e = makeEngine(5);
    feedChain(e, 'blue', 5);
    const hud = e.getHud();
    hud.morph.tiers.blue = 99;
    expect(e.morph.tiers.blue).toBe(1);
  });
});

// ---------- combat (P2-P4) ----------

type EnginePriv = {
  invuln: number;
  steerLock: number;
  bossIndex: number;
  bossQueue: number;
  poisonStacks: number;
  ambientTimer: number;
  path: { x: number; y: number }[];
  applyDamageToSnake(dmg: number, special: boolean): void;
  damageBoss(dmg: number): void;
  summonMinions(b: NonNullable<GameEngine['boss']>): void;
  damageMinion(m: GameEngine['minions'][number], dmg: number, byPoison?: boolean): void;
};
function priv(e: GameEngine): EnginePriv {
  return e as unknown as EnginePriv;
}

/** Keep the head pinned at map center so combat runs don't drift into a wall. */
function pinHead(e: GameEngine) {
  const head = e.snake[0];
  head.x = GRID / 2;
  head.y = GRID / 2;
  priv(e).invuln = 0;
  e.beans.length = 0;
}

/** Advance seconds with the head pinned; stops early if phase leaves playing. */
function advancePinned(e: GameEngine, seconds: number, dt = 1 / 120) {
  let t = 0;
  while (t < seconds && e.phase === 'playing') {
    e.update(dt);
    pinHead(e);
    t += dt;
  }
}

/** Force a boss into existence next to the head, past its telegraph. */
function forceBoss(e: GameEngine, score: number, dist = 4) {
  e.score = score;
  e.peakScore = score;
  e.boss = {
    id: 1,
    pos: { x: e.snake[0].x + dist, y: e.snake[0].y },
    hp: 5 * score,
    maxHp: 5 * score,
    anchorScore: score,
    phase: 1,
    telegraph: 0,
    fireCooldown: 999,
    aimedCooldown: 999,
    specialCooldown: 999,
    summonCooldown: 999,
    moveTarget: null,
    retargetTimer: 999, // hold position: these tests probe shooting, not wandering
    hitCooldown: 0,
    slowTimer: 0,
  };
  return e.boss;
}

describe('Boss 刷新与阈值', () => {
  it('分数达到 5000 阈值时刷新 Boss，血量锚定刷新时分数', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 5200;
    advancePinned(e, 0.05);
    expect(e.boss).not.toBeNull();
    expect(e.boss!.anchorScore).toBe(5200);
    expect(e.boss!.maxHp).toBeCloseTo(5200 * 5);
    expect(e.boss!.telegraph).toBeGreaterThan(0);
  });

  it('每个阈值只刷新一次：掉分再回来不会重复刷新', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 5200;
    advancePinned(e, 0.05);
    expect(e.boss).not.toBeNull();
    // kill it, then hover around the same threshold
    e.boss!.telegraph = 0;
    priv(e).damageBoss(e.boss!.hp + 1);
    expect(e.boss).toBeNull();
    expect(e.stats.bossesKilled).toBe(1);
    e.score = 4000;
    advancePinned(e, 0.1);
    e.score = 5300;
    advancePinned(e, 0.1);
    expect(e.boss).toBeNull();
    expect(priv(e).bossIndex).toBe(1);
    // crossing the NEXT threshold spawns again
    e.score = 10100;
    advancePinned(e, 0.1);
    expect(e.boss).not.toBeNull();
    expect(priv(e).bossIndex).toBe(2);
  });

  it('击杀 Boss 奖励分数并计入统计', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000);
    const before = e.score;
    priv(e).damageBoss(boss.hp + 1);
    expect(e.boss).toBeNull();
    expect(e.stats.bossesKilled).toBe(1);
    expect(e.score).toBe(before + Math.round(0.25 * 4000));
    expect(e.bullets.length).toBe(0);
  });

  it('Boss 发射弹幕，子弹只伤害蛇头（命中扣锚定分数的伤害）', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 5);
    boss.fireCooldown = 0;
    const before = e.score;
    // let the boss fire and the bullet travel + muzzle (0.5s) reach the head
    advancePinned(e, 2.0);
    expect(e.score).toBeLessThan(before);
    expect(e.score).toBe(before - Math.round(0.05 * 4000));
  });

  it('护盾抵挡弹幕：整次伤害被挡下且不掉分', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 5);
    boss.fireCooldown = 0;
    e.shields = 2;
    advancePinned(e, 2.0);
    expect(e.score).toBe(4000);
    expect(e.shields).toBe(1);
  });

  it('0 分后再受击即死亡（与撞墙同管线，第二生命可抵消）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 0;
    priv(e).applyDamageToSnake(100, false);
    expect(e.phase).toBe('dead');

    const e2 = makeEngine(12);
    pinHead(e2);
    e2.upgrades.set('secondLife', 1);
    e2.score = 0;
    priv(e2).applyDamageToSnake(100, false);
    expect(e2.phase).toBe('playing');
    expect(e2.secondLifeUsed).toBe(true);
  });

  it('特种子弹命中附加虚弱 debuff', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 3000;
    priv(e).applyDamageToSnake(100, true);
    expect(e.hasEffect('weak')).toBe(true);
  });
});

describe('小怪', () => {
  it('Boss 二阶段召唤小怪，小怪追踪并冲撞蛇头', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 8);
    boss.hp = boss.maxHp * 0.5; // phase 2
    priv(e).summonMinions(boss);
    expect(e.minions.length).toBeGreaterThan(0);
    const m = e.minions[0];
    expect(m.maxHp).toBeCloseTo(0.2 * 4000);
    const before = e.score;
    // teleport a minion next to the head so it rams immediately
    m.pos = { x: e.snake[0].x + 0.3, y: e.snake[0].y };
    advancePinned(e, 0.05);
    expect(e.score).toBe(before - Math.round(0.03 * 4000));
  });

  it('击杀小怪返还少量分数', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 8);
    priv(e).summonMinions(boss);
    const m = e.minions[0];
    const before = e.score;
    m.hp = 1;
    // kill via a player shot
    e.playerShots.push({
      id: 999,
      pos: { x: m.pos.x, y: m.pos.y },
      vel: { x: 0, y: 0 },
      dmg: 10,
      radius: 0.35,
      color: '#fff',
      homing: false,
      targetId: null,
      effect: 'none',
      life: 1,
    });
    advancePinned(e, 0.02);
    expect(e.minions.some((x) => x.id === m.id)).toBe(false);
    expect(e.score).toBe(before + Math.round(0.01 * 4000));
  });
});

describe('Boss 移动与接触伤害', () => {
  it('telegraph 期间 Boss 站定不动', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 5200;
    advancePinned(e, 0.05);
    const boss = e.boss!;
    expect(boss.telegraph).toBeGreaterThan(0);
    const p0 = { ...boss.pos };
    advancePinned(e, 0.5); // still inside the 1.2s telegraph
    expect(boss.pos.x).toBe(p0.x);
    expect(boss.pos.y).toBe(p0.y);
  });

  it('激活后 Boss 沿交战环游走：位置变化但不会贴脸也不会跑远', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 10);
    boss.retargetTimer = 0; // release the wander hold
    const p0 = { ...boss.pos };
    let maxMoved = 0;
    let t = 0;
    while (t < 3 && e.phase === 'playing') {
      e.update(1 / 120);
      pinHead(e);
      t += 1 / 120;
      maxMoved = Math.max(maxMoved, Math.hypot(boss.pos.x - p0.x, boss.pos.y - p0.y));
    }
    const head = e.snake[0];
    const d = Math.hypot(boss.pos.x - head.x, boss.pos.y - head.y);
    expect(maxMoved).toBeGreaterThan(0.5);
    expect(d).toBeGreaterThan(2); // never hugs the head
    expect(d).toBeLessThan(22); // never wanders off
    expect(boss.pos.x).toBeGreaterThanOrEqual(4);
    expect(boss.pos.x).toBeLessThanOrEqual(GRID - 4);
    expect(boss.pos.y).toBeGreaterThanOrEqual(4);
    expect(boss.pos.y).toBeLessThanOrEqual(GRID - 4);
    expect(e.phase).toBe('playing'); // wandering alone killed nobody
  });

  it('Boss 身体接触蛇头：扣锚定伤害 + 击退 + 转向锁，且带冷却', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 1); // start inside the contact radius
    advancePinned(e, 0.02);
    expect(e.score).toBe(4000 - Math.round(0.05 * 4000));
    expect(boss.hitCooldown).toBeGreaterThan(0);
    expect(priv(e).steerLock).toBeGreaterThan(0);
    // second contact inside the cooldown window deals nothing
    advancePinned(e, 0.1);
    expect(e.score).toBe(4000 - Math.round(0.05 * 4000));
  });
});

describe('环境野怪', () => {
  it('无 Boss 时在视野外刷出 ambient 小怪（距蛇头 ≥16 格）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 3000;
    priv(e).ambientTimer = 0.1;
    advancePinned(e, 0.25);
    expect(e.minions.length).toBe(1);
    const m = e.minions[0];
    expect(m.ambient).toBe(true);
    expect(m.anchorScore).toBe(3000);
    const head = e.snake[0];
    expect(Math.hypot(m.pos.x - head.x, m.pos.y - head.y)).toBeGreaterThan(14);
  });

  it('总数受 MINION_CAP 约束：满了就不再刷', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 3000;
    for (let i = 0; i < 4; i++) {
      e.minions.push({ id: 100 + i, pos: { x: 5 + i, y: 5 }, hp: 10, maxHp: 10, anchorScore: 100, hitCooldown: 0, ambient: false, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 });
    }
    priv(e).ambientTimer = 0.1;
    advancePinned(e, 0.3);
    expect(e.minions.length).toBe(4);
  });

  it('Boss 存活期间暂停环境刷怪，计时器不走', () => {
    const e = makeEngine(11);
    pinHead(e);
    forceBoss(e, 4000, 8);
    priv(e).ambientTimer = 0.1;
    advancePinned(e, 0.5);
    expect(e.minions.length).toBe(0);
    expect(priv(e).ambientTimer).toBe(0.1);
  });

  it('ambient 野怪被击杀时掉一颗基因豆', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.beans.length = 0;
    const m = { id: 7, pos: { x: e.snake[0].x + 6, y: e.snake[0].y }, hp: 1, maxHp: 1, anchorScore: 100, hitCooldown: 0, ambient: true, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 };
    e.minions.push(m);
    priv(e).damageMinion(m, 5);
    expect(e.minions[0].hp).toBeLessThanOrEqual(0);
    expect(e.beans.length).toBe(1);
    expect(['red', 'blue', 'green']).toContain(e.beans[0].kind);
  });
});

describe('障碍物', () => {
  it('种子生成：数量/边距/间距/出生点净空都达标，且同种子结果确定', () => {
    for (const seed of [1, 7, 11, 42, 99]) {
      const e = makeEngine(seed);
      expect(e.obstacles.length).toBeGreaterThanOrEqual(3);
      expect(e.obstacles.length).toBeLessThanOrEqual(5);
      for (const o of e.obstacles) {
        expect(o.w).toBeGreaterThanOrEqual(3);
        expect(o.w).toBeLessThanOrEqual(5);
        expect(o.h).toBeGreaterThanOrEqual(3);
        expect(o.h).toBeLessThanOrEqual(5);
        expect(o.x).toBeGreaterThanOrEqual(5);
        expect(o.y).toBeGreaterThanOrEqual(5);
        expect(o.x + o.w).toBeLessThanOrEqual(GRID - 5);
        expect(o.y + o.h).toBeLessThanOrEqual(GRID - 5);
        const dx = Math.max(o.x - GRID / 2, 0, o.x + o.w - GRID / 2);
        const dy = Math.max(o.y - GRID / 2, 0, o.y + o.h - GRID / 2);
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(9);
        expect(e.isBlocked(o.x, o.y)).toBe(true);
        expect(e.isBlocked(o.x + o.w - 0.5, o.y + o.h - 0.5)).toBe(true);
        expect(e.isBlocked(o.x - 0.5, o.y + 0.5)).toBe(false);
      }
      for (let i = 0; i < e.obstacles.length; i++) {
        for (let j = i + 1; j < e.obstacles.length; j++) {
          const a = e.obstacles[i];
          const b = e.obstacles[j];
          const overlaps = a.x < b.x + b.w + 10 && b.x < a.x + a.w + 10 && a.y < b.y + b.h + 10 && b.y < a.y + a.h + 10;
          expect(overlaps).toBe(false);
        }
      }
    }
    expect(makeEngine(11).obstacles).toEqual(makeEngine(11).obstacles);
  });

  it('豆子永远不会生成在障碍物里', () => {
    const e = makeEngine(42);
    expect(e.beans.length).toBeGreaterThan(0);
    for (const b of e.beans) expect(e.isBlocked(b.pos.x, b.pos.y)).toBe(false);
    advance(e, 3);
    for (const b of e.beans) expect(e.isBlocked(b.pos.x, b.pos.y)).toBe(false);
  });

  it('蛇头撞上障碍物即死（与撞墙一致）', () => {
    const e = makeEngine(42);
    const o = e.obstacles[0];
    const head = e.snake[0];
    head.x = o.x - 0.6;
    head.y = o.y + o.h / 2;
    e.heading = 0;
    for (let i = 1; i < e.snake.length; i++) {
      e.snake[i].x = head.x - i;
      e.snake[i].y = head.y;
    }
    priv(e).path = [];
    for (let d = 0; d <= 12; d += 0.25) priv(e).path.push({ x: head.x - d, y: head.y });
    let t = 0;
    while (t < 1 && e.phase === 'playing') {
      e.update(1 / 120);
      t += 1 / 120;
    }
    expect(e.phase).not.toBe('playing');
  });

  it('Boss 子弹撞上障碍物被销毁（掩体机制）', () => {
    const e = makeEngine(42);
    pinHead(e);
    const o = e.obstacles[0];
    e.bullets.push({
      id: 1,
      pos: { x: o.x - 1.5, y: o.y + 0.5 },
      vel: { x: 12, y: 0 },
      dmg: 999,
      radius: 0.25,
      color: '#FF5365',
      special: false,
      muzzle: 0,
      life: 5,
    });
    advancePinned(e, 0.3);
    expect(e.bullets.length).toBe(0);
    expect(e.phase).toBe('playing');
    expect(e.score).toBe(0); // never reached the head
  });

  it('玩家能量弹撞上障碍物被销毁', () => {
    const e = makeEngine(42);
    pinHead(e);
    const o = e.obstacles[0];
    e.playerShots.push({
      id: 1,
      pos: { x: o.x - 1.2, y: o.y + 0.5 },
      vel: { x: 20, y: 0 },
      dmg: 50,
      radius: 0.35,
      color: '#fff',
      homing: false,
      targetId: null,
      effect: 'none',
      life: 3,
    });
    advancePinned(e, 0.2);
    expect(e.playerShots.length).toBe(0);
  });

  it('小怪击退不会把蛇头推进障碍物（伤害照常结算）', () => {
    const e = makeEngine(42);
    const o = e.obstacles[0];
    e.score = 4000;
    e.peakScore = 4000;
    const head = e.snake[0];
    head.x = o.x - 0.35;
    head.y = o.y + 0.5;
    e.heading = 0;
    for (let i = 1; i < e.snake.length; i++) {
      e.snake[i].x = head.x - i;
      e.snake[i].y = head.y;
    }
    priv(e).path = [];
    for (let d = 0; d <= 12; d += 0.25) priv(e).path.push({ x: head.x - d, y: head.y });
    // minion just behind the head: its ram would shove the head +x into the slab
    e.minions.push({ id: 4, pos: { x: head.x - 0.45, y: head.y }, hp: 100, maxHp: 100, anchorScore: 100, hitCooldown: 0, ambient: false, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 });
    let t = 0;
    while (t < 0.05 && e.phase === 'playing') {
      e.update(1 / 120);
      t += 1 / 120;
    }
    expect(e.score).toBe(4000 - Math.round(0.03 * 100)); // ram damage still lands
    expect(e.snake[0].x).toBeLessThan(o.x); // knockback was skipped, head stayed clear
    expect(e.phase).toBe('playing');
  });
});

describe('玩家攻击', () => {
  it('无形态：按住攻击沿蛇头朝向发射能量弹', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.peakScore = 2000;
    e.setAttack(true);
    advancePinned(e, 0.02);
    expect(e.playerShots.length).toBe(1);
    expect(e.playerShots[0].dmg).toBeCloseTo(0.075 * 2000);
    expect(e.playerShots[0].vel.x).toBeGreaterThan(0);
    e.setAttack(false);
  });

  it('攻击方向始终跟随蛇头朝向（与鼠标无关）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.peakScore = 2000;
    e.setAttack(true);
    e.setSteer(0, -1); // turn the head upward; aim must follow
    advancePinned(e, 0.5);
    expect(e.aimX).toBeCloseTo(0, 1);
    expect(e.aimY).toBeCloseTo(-1, 1);
    advancePinned(e, 0.2);
    expect(e.playerShots.some((s) => s.vel.y < 0)).toBe(true);
    e.setAttack(false);
  });

  it('能量弹命中 Boss 造成伤害', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 3);
    e.setAttack(true);
    const hp0 = boss.hp;
    advancePinned(e, 0.4);
    expect(boss.hp).toBeLessThan(hp0);
    e.setAttack(false);
  });

  it('红色形态发射重型追踪炮弹（大弹体、高伤害、无 DoT）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.tiers.red = 2;
    const boss = forceBoss(e, 4000, 3);
    e.setAttack(true);
    advancePinned(e, 0.02);
    expect(e.playerShots.length).toBe(1);
    const s = e.playerShots[0];
    expect(s.homing).toBe(true);
    expect(s.radius).toBe(RED_SHOT_RADIUS);
    expect(s.effect).toBe('none');
    expect(s.dmg).toBeCloseTo(ATTACK_BASE_DPS * RED_SHOT_INTERVAL * RED_DMG_MULT * 4000 * ATTACK_FORM_MULT.red[1]);
    const hp0 = boss.hp;
    advancePinned(e, RED_SHOT_INTERVAL + 0.3);
    expect(boss.hp).toBeLessThan(hp0);
    expect(priv(e).poisonStacks).toBe(0); // red no longer applies any DoT
    e.setAttack(false);
  });

  it('蓝色形态速射追踪弹，命中附加冰冻减速', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.tiers.blue = 1;
    const spawned = forceBoss(e, 4000, 3);
    spawned.pos = { x: e.snake[0].x + 3, y: e.snake[0].y + 3 }; // off-axis: homing must curve
    e.setAttack(true);
    advancePinned(e, 0.02);
    expect(e.playerShots.length).toBe(1);
    expect(e.playerShots[0].homing).toBe(true);
    expect(e.playerShots[0].effect).toBe('slow');
    expect(e.playerShots[0].vel.x).toBeGreaterThan(0); // initially along the heading (+x)
    const boss = e.boss!;
    const hp0 = boss.hp;
    advancePinned(e, 0.8);
    expect(boss.hp).toBeLessThan(hp0);
    expect(boss.slowTimer).toBeGreaterThan(0); // freeze refreshed by ongoing hits
    e.setAttack(false);
  });

  it('蓝色冰冻降低 Boss 射击频率（冷却走得更慢）', () => {
    const e = makeEngine(11);
    pinHead(e);
    const boss = forceBoss(e, 4000, 8);
    boss.fireCooldown = 1;
    advancePinned(e, 0.5);
    const unfrozen = boss.fireCooldown;
    boss.fireCooldown = 1;
    boss.slowTimer = 5;
    advancePinned(e, 0.5);
    expect(boss.fireCooldown).toBeGreaterThan(unfrozen);
  });

  it('绿色形态毒弹叠加 DoT：停止攻击后仍持续扣血', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.tiers.green = 1;
    const boss = forceBoss(e, 4000, 3);
    e.setAttack(true);
    advancePinned(e, 0.5);
    expect(priv(e).poisonStacks).toBeGreaterThan(0);
    const hp0 = boss.hp;
    // stop attacking: the poison DoT alone keeps chewing the boss
    e.setAttack(false);
    advancePinned(e, 0.3);
    expect(boss.hp).toBeLessThan(hp0);
  });

  it('毒层数封顶 POISON_MAX_STACKS', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.tiers.green = 1;
    forceBoss(e, 4000, 3);
    e.setAttack(true);
    advancePinned(e, 2.4); // 0.4s cadence → well past 5 hits
    e.setAttack(false);
    expect(priv(e).poisonStacks).toBe(POISON_MAX_STACKS);
  });

  it('毒死小怪返还少量分数（击杀奖励 + 毒杀回馈）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.score = 500;
    const m = { id: 7, pos: { x: e.snake[0].x + 3, y: e.snake[0].y }, hp: 1, maxHp: 1, anchorScore: 4000, hitCooldown: 0, ambient: false, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 };
    e.minions.push(m);
    priv(e).damageMinion(m, 5, true);
    expect(e.score).toBe(
      500 + Math.round(MINION_KILL_SCORE_FRAC * 4000) + Math.round(POISON_KILL_HEAL_FRAC * 4000),
    );
  });

  it('锁定范围外的敌人：弹道呈直线（锁不到目标）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.tiers.blue = 1;
    const spawned = forceBoss(e, 4000, 3);
    spawned.pos = { x: e.snake[0].x + ATTACK_LOCK_RANGE + 4, y: e.snake[0].y };
    e.setAttack(true);
    advancePinned(e, BLUE_SHOT_INTERVAL + 0.02);
    expect(e.playerShots.length).toBeGreaterThan(0);
    for (const s of e.playerShots) {
      expect(s.homing).toBe(false);
      expect(s.targetId).toBeNull();
    }
    e.setAttack(false);
  });

  it('元素附着放大攻击伤害（fireAtk ×1.35）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.peakScore = 2000;
    e.effects.push({ kind: 'fireAtk', remaining: 7, duration: 7 });
    e.setAttack(true);
    advancePinned(e, 0.02);
    expect(e.playerShots[0].dmg).toBeCloseTo(0.075 * 2000 * 1.35);
    e.setAttack(false);
  });

  it('虹彩形态发射双列高速子弹（雷霆战机式）', () => {
    const e = makeEngine(11);
    pinHead(e);
    e.morph.prism = true;
    e.peakScore = 2000;
    e.setAttack(true);
    advancePinned(e, 0.05);
    expect(e.playerShots.length).toBe(2);
    const [a, b] = e.playerShots;
    // parallel columns along the heading (+x), offset laterally
    expect(a.vel.x).toBeCloseTo(PRISM_BULLET_SPEED);
    expect(b.vel.x).toBeCloseTo(PRISM_BULLET_SPEED);
    expect(a.vel.y).toBeCloseTo(0);
    expect(Math.abs(a.pos.y - b.pos.y)).toBeCloseTo(PRISM_COLUMN_OFFSET * 2);
    expect(a.dmg).toBe(b.dmg);
    // rapid fire: a second volley lands within 0.2s
    const ids = new Set(e.playerShots.map((s) => s.id));
    advancePinned(e, 0.2);
    expect(e.playerShots.some((s) => !ids.has(s.id))).toBe(true);
    e.setAttack(false);
  });
});

describe('战斗 HUD', () => {
  it('HUD 暴露 Boss 摘要、下一阈值与攻击形态', () => {
    const e = makeEngine(11);
    pinHead(e);
    forceBoss(e, 4000);
    e.morph.tiers.red = 1;
    const hud = e.getHud();
    expect(hud.boss).not.toBeNull();
    expect(hud.boss!.anchorScore).toBe(4000);
    expect(hud.nextBossAt).toBe(5000);
    expect(hud.attackForm).toBe('red');
    expect(hud.stats.bossesKilled).toBe(0);
  });
});
