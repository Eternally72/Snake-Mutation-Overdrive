import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { GRID, MIN_SNAKE_LENGTH, upgradeThreshold } from '../src/game/config';

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

describe('基础规则', () => {
  it('蛇正常移动且不反向', () => {
    const e = makeEngine();
    const head0 = { ...e.snake[0] };
    steps(e, 1);
    expect(e.snake[0].x).toBe(head0.x + 1);
    // 反向输入被忽略
    e.enqueueDir('left');
    steps(e, 1);
    expect(e.snake[0].x).toBe(head0.x + 2);
  });

  it('输入缓冲：连续两个转向都被执行', () => {
    const e = makeEngine();
    e.enqueueDir('up');
    e.enqueueDir('left');
    steps(e, 1);
    expect(e.dir).toBe('up');
    steps(e, 1);
    expect(e.dir).toBe('left');
  });

  it('撞墙死亡', () => {
    const e = makeEngine();
    // head at x=8 moving right, wall at x=19 → 11 steps to hit
    steps(e, 20);
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

  it('撞自己死亡', () => {
    const e = makeEngine();
    // grow the snake long enough, then loop into itself
    e.beans.length = 0;
    // feed 6 beans ahead to grow
    for (let i = 0; i < 6; i++) {
      const head = e.snake[0];
      e.beans.push({ id: 1000 + i, kind: 'red', pos: { x: head.x + 1, y: head.y }, born: 0 });
      stepSkipUpgrade(e);
      if (e.phase !== 'playing') break;
      e.beans.length = 0;
    }
    expect(e.snake.length).toBeGreaterThanOrEqual(8);
    // tight loop: up, left, down → into own body
    e.enqueueDir('up');
    steps(e, 1);
    e.enqueueDir('left');
    steps(e, 1);
    e.enqueueDir('down');
    steps(e, 2);
    expect(['dead']).toContain(e.phase);
  });

  it('移动到即将腾空的尾巴格不死亡', () => {
    const e = makeEngine();
    // construct a 4-segment snake whose head can legally move into the vacating tail cell
    e.beans.length = 0;
    e.snake = [
      { x: 10, y: 10, color: 'green' },
      { x: 10, y: 11, color: 'green' },
      { x: 11, y: 11, color: 'green' },
      { x: 11, y: 10, color: 'green' },
    ];
    e.prevSnake = e.snake.map((s) => ({ x: s.x, y: s.y }));
    e.dir = 'up';
    e.enqueueDir('right'); // target cell (11,10) is the current tail, which vacates this step
    steps(e, 1);
    expect(e.phase).toBe('playing');
    expect(e.snake[0]).toMatchObject({ x: 11, y: 10 });
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
    e.shields = 1;
    // grow to length >= 8
    for (let i = 0; i < 5; i++) {
      const head = e.snake[0];
      e.beans.length = 0;
      e.beans.push({ id: 3000 + i, kind: 'green', pos: { x: head.x + 1, y: head.y }, born: 0 });
      steps(e, 1);
      if (e.phase !== 'playing') break;
    }
    e.shields = 1;
    e.enqueueDir('up');
    steps(e, 1);
    e.enqueueDir('left');
    steps(e, 1);
    e.enqueueDir('down');
    steps(e, 2);
    expect(e.phase).toBe('playing');
    expect(e.shields).toBe(0);
    // body has no duplicates
    const keys = e.snake.map((s) => `${s.x},${s.y}`);
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
    expect(e.snake[0].x).toBe(head0.x + 3);
    expect(e.skill).toBeNull(); // single charge consumed
    // at the wall, dash refuses
    e.skill = { kind: 'dash', charges: 1 };
    e.snake[0].x = GRID - 1;
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
    // run into the right wall
    for (let i = 0; i < 30 && e.phase === 'playing'; i++) {
      steps(e, 1);
      if (e.phase !== 'playing') break;
      if (e.snake[0].x >= GRID - 1 && e.dir === 'right') {
        // next step triggers second life; then steer down to escape
        steps(e, 1);
        break;
      }
    }
    expect(e.phase).toBe('playing');
    expect(e.secondLifeUsed).toBe(true);
    // frozen near wall; steer away
    e.enqueueDir('down');
    for (let i = 0; i < 5 && e.snake[0].x === GRID - 1; i++) steps(e, 1);
    expect(e.phase).toBe('playing');
    expect(e.snake[0].y).toBeGreaterThan(9);
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
    steps(e, 1);
    expect(e.snake[0].x).toBe(head0.x + 1);
  });
});
