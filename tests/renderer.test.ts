// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { Renderer } from '../src/game/renderer';

function stubCanvas() {
  const gradient = { addColorStop: () => {} };
  const ctxProxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
        if (prop === 'canvas') return { width: 600, height: 600 };
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxProxy as unknown as RenderingContext);
}

describe('渲染器持续 buff 特效', () => {
  it('多重效果叠加渲染不抛异常（含粒子发射路径）', () => {
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(800, 600);
    const engine = new GameEngine(7);
    engine.effects.push(
      { kind: 'flame', remaining: 6, duration: 8 },
      { kind: 'iceArmor', remaining: 5, duration: 7 },
      { kind: 'charged', remaining: 4, duration: 7 },
      { kind: 'haste', remaining: 3, duration: 7 },
      { kind: 'resonanceBoost', remaining: 8, duration: 10 },
    );
    // 90 frames ≈ 1.5s, enough to cross several emit intervals
    for (let i = 0; i < 90; i++) {
      engine.update(1 / 60);
      renderer.handleFx(engine.drainFx(), false);
      renderer.render(engine, 1 / 60, { reducedMotion: false, time: i / 60 });
    }
    expect(engine.effects.length).toBeGreaterThan(0);
  });

  it('reducedMotion 下同样安全', () => {
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(800, 600);
    const engine = new GameEngine(9);
    engine.effects.push({ kind: 'alien', remaining: 6, duration: 8 }, { kind: 'fog', remaining: 4, duration: 6 });
    for (let i = 0; i < 30; i++) {
      engine.update(1 / 60);
      renderer.render(engine, 1 / 60, { reducedMotion: true, time: i / 60 });
    }
    expect(engine.effects.length).toBe(2);
  });
});

describe('渲染器形态外观（morph）', () => {
  function frames(engine: GameEngine, renderer: Renderer, n: number, reducedMotion: boolean) {
    for (let i = 0; i < n; i++) {
      engine.update(1 / 60);
      renderer.handleFx(engine.drainFx(), false);
      renderer.render(engine, 1 / 60, { reducedMotion, time: i / 60 });
    }
  }

  function setup() {
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(800, 600);
    return renderer;
  }

  it('单系究极形态渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    engine.morph.tiers.red = 3;
    frames(engine, renderer, 30, false);
    expect(engine.morph.tiers.red).toBe(3);
  });

  it('多系混合形态渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    engine.morph.tiers.red = 2;
    engine.morph.tiers.blue = 2;
    engine.morph.tiers.green = 1;
    frames(engine, renderer, 30, false);
    expect(engine.morph.tiers.blue).toBe(2);
  });

  it('虹彩巨蛇（prism）形态渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    engine.morph.tiers.red = 1;
    engine.morph.tiers.blue = 1;
    engine.morph.tiers.green = 1;
    engine.morph.prism = true;
    frames(engine, renderer, 30, false);
    expect(engine.morph.prism).toBe(true);
  });

  it('reducedMotion 下形态渲染同样安全', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    engine.morph.tiers.green = 3;
    frames(engine, renderer, 20, true);
    expect(engine.morph.tiers.green).toBe(3);
  });
});

describe('强化特效', () => {
  function setup() {
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(800, 600);
    return renderer;
  }

  it('关键节点的强化特效（震屏/多层爆炸）渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    renderer.handleFx(
      [
        { type: 'bossDeath', pos: { x: 5, y: 5 }, color: '#FFD75E' },
        { type: 'bossSpawn', pos: { x: 6, y: 6 } },
        { type: 'evolve', gene: 'red', count: 36 },
        { type: 'chain', gene: 'blue', count: 6 },
        { type: 'reaction', pos: { x: 4, y: 4 } },
        { type: 'shieldBreak', pos: { x: 4, y: 5 } },
        { type: 'secondLife' },
        { type: 'upgrade', text: '强化' },
        { type: 'eventStart', text: '事件' },
        { type: 'playerHit', pos: { x: 5, y: 4 }, text: '-200' },
      ],
      false,
    );
    for (let i = 0; i < 40; i++) {
      renderer.render(engine, 1 / 60, { reducedMotion: false, time: i / 60 });
    }
    // reducedMotion must stay calm but safe
    renderer.handleFx([{ type: 'bossDeath', pos: { x: 5, y: 5 } }, { type: 'death', pos: { x: 5, y: 5 } }], true);
    renderer.render(engine, 1 / 60, { reducedMotion: true, time: 1 });
    expect(engine.phase).toBe('playing');
  });
});

describe('渲染器战斗实体', () => {
  function setup() {
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(800, 600);
    return renderer;
  }

  function withCombat(engine: GameEngine) {
    const head = engine.snake[0];
    engine.boss = {
      id: 1,
      pos: { x: head.x + 4, y: head.y + 2 },
      hp: 8000,
      maxHp: 20000,
      anchorScore: 4000,
      phase: 2,
      telegraph: 0,
      fireCooldown: 1,
      aimedCooldown: 1,
      specialCooldown: 1,
      summonCooldown: 1,
      moveTarget: null,
      retargetTimer: 999, // hold position while rendering is exercised
      hitCooldown: 0,
      slowTimer: 0,
    };
    engine.bullets.push(
      { id: 2, pos: { x: head.x + 2, y: head.y }, vel: { x: -6, y: 0 }, dmg: 200, radius: 0.45, color: '#FF5365', special: false, muzzle: 0.3, life: 8 },
      { id: 3, pos: { x: head.x + 1, y: head.y + 1 }, vel: { x: 0, y: -6 }, dmg: 320, radius: 0.45, color: '#B176FF', special: true, muzzle: 0, life: 8 },
    );
    engine.minions.push({ id: 4, pos: { x: head.x - 2, y: head.y + 1 }, hp: 400, maxHp: 800, anchorScore: 4000, hitCooldown: 0, ambient: false, slowTimer: 0, poisonStacks: 0, poisonTimer: 0 });
    engine.playerShots.push({ id: 5, pos: { x: head.x + 0.5, y: head.y }, vel: { x: 16, y: 0 }, dmg: 300, radius: 0.35, color: '#BFE6FF', homing: false, targetId: null, effect: 'none', life: 1.4 });
  }

  it('Boss/子弹/小怪/玩家弹渲染不抛异常（含预警与指引箭头）', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    withCombat(engine);
    engine.boss!.telegraph = 0.8; // warning-telegraph path
    for (let i = 0; i < 30; i++) {
      engine.boss!.telegraph = Math.max(0, 0.8 - i * 0.05);
      renderer.handleFx(engine.drainFx(), false);
      renderer.render(engine, 1 / 60, { reducedMotion: false, time: i / 60 });
    }
    expect(engine.boss).not.toBeNull();
  });

  it('屏幕外 Boss 触发指引箭头，reducedMotion 下同样安全', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    withCombat(engine);
    engine.boss!.pos = { x: 4, y: 4 }; // far outside the viewport around the head
    for (let i = 0; i < 40; i++) {
      renderer.render(engine, 1 / 60, { reducedMotion: true, time: i / 60 });
    }
    expect(engine.boss).not.toBeNull();
  });

  it('持续攻击时各形态的攻击视觉（追踪弹/双列弹幕/瞄准线）渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    engine.setAttack(true);
    const forms: Array<(e: GameEngine) => void> = [
      () => {}, // none → straight bolts + dashed aim line
      (e) => { e.morph.tiers.blue = 1; }, // blue → rapid homing bolts (freeze)
      (e) => { e.morph.tiers.blue = 0; e.morph.tiers.red = 2; }, // red → heavy homing shells
      (e) => { e.morph.tiers.red = 0; e.morph.tiers.green = 1; }, // green → poison homing bolts
      (e) => { e.morph.tiers.green = 0; e.morph.prism = true; }, // prism → twin homing rainbow columns
    ];
    for (const apply of forms) {
      apply(engine);
      for (let i = 0; i < 15; i++) {
        engine.update(1 / 60);
        renderer.handleFx(engine.drainFx(), false);
        renderer.render(engine, 1 / 60, { reducedMotion: false, time: i / 60 });
      }
    }
    engine.setAttack(false);
    renderer.render(engine, 1 / 60, { reducedMotion: false, time: 2 });
    expect(engine.attackActive).toBe(false);
  });

  it('冰冻/中毒状态着色（Boss 冰蓝罩+毒环、小怪冰蓝罩）渲染不抛异常', () => {
    const renderer = setup();
    const engine = new GameEngine(3);
    withCombat(engine);
    engine.boss!.slowTimer = 2;
    engine.minions[0].slowTimer = 2;
    (engine as unknown as { applyPoisonBoss(): void }).applyPoisonBoss();
    for (let i = 0; i < 30; i++) {
      renderer.handleFx(engine.drainFx(), false);
      renderer.render(engine, 1 / 60, { reducedMotion: false, time: i / 60 });
    }
    expect(engine.bossPoisonStacks).toBe(1);
  });
});
