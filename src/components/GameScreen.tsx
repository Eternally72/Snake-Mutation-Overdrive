import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { Renderer } from '../game/renderer';
import { initAudio, setMusicPaused, startMusic, stopMusic, sfx } from '../game/audio';
import {
  BOSS_ARROW_COLORS,
  BOSS_STEP,
  CHAIN_HELP,
  COLORS,
  DEBUFF_EFFECTS,
  EFFECT_COLORS,
  EFFECT_DESCS,
  EFFECT_LABELS,
  EVENT_DEFS,
  GENE_COLORS,
  GENE_NAMES,
  MORPH_HELP,
  MORPH_MAX_STAGE,
  MORPH_STAGE_NAMES,
  SKILL_DESCS,
  SKILL_NAMES,
  UPGRADE_MAP,
  morphSummary,
} from '../game/config';
import type { AttackForm, FxEvent, HudState, UpgradeId } from '../game/types';
import type { Settings } from '../game/storage';
import UpgradeModal from './UpgradeModal';
import GameOverModal from './GameOverModal';
import InfoTip from './InfoTip';

interface Props {
  highScore: number;
  settings: Settings;
  onGameEnd: (score: number) => void;
  onExit: () => void;
}

const KEY_VEC: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  W: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  A: { x: -1, y: 0 },
  D: { x: 1, y: 0 },
};

// freeze-frame durations (ms) on key moments: logic pauses while particles keep animating
const HIT_STOP_MS: Partial<Record<FxEvent['type'], number>> = {
  bossDeath: 160,
  death: 180,
  evolve: 100,
  reaction: 80,
  secondLife: 100,
};

const ATTACK_FORM_NAMES: Record<AttackForm, string> = {
  none: '能量弹',
  red: '炎狱兽 · 重炮追踪弹',
  blue: '渊灵 · 冰冻速射',
  green: '共生体 · 毒液弹',
  prism: '虹彩巨蛇 · 双列追踪弹幕',
};

const ATTACK_FORM_COLORS: Record<AttackForm, string> = {
  none: '#BFE6FF',
  red: '#FF5365',
  blue: '#43BFFF',
  green: '#4EF1A3',
  prism: '#B176FF',
};

const ATTACK_FORM_DESCS: Record<AttackForm, string> = {
  none: '当前形态：基础能量弹，每 0.5 秒沿蛇头朝向发射一枚直线能量弹。\n完成 5 连进化获得形态后，攻击升级为自动锁敌的追踪弹。',
  red: '当前形态·红：低频重型追踪炮弹，弹体大、伤害高，锁定范围内离蛇头最近的敌人。',
  blue: '当前形态·蓝：高频小型追踪弹，命中附加冰冻减速（Boss 移动与射击变慢，可刷新）；幽体期间 30% 概率闪避伤害。',
  green: '当前形态·绿：中频毒液追踪弹，命中叠加毒层（最多 5 层）持续扣血；毒死小怪额外返还少量分数。',
  prism: '当前形态·虹彩：双列彩虹追踪弹幕，两列光弹锁定同一目标倾泻输出，全形态最强火力。',
};

export default function GameScreen({ highScore, settings, onGameEnd, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const endedRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const keysDown = useRef<Set<string>>(new Set());

  if (!engineRef.current) engineRef.current = new GameEngine();

  const restart = useCallback(() => {
    const engine = engineRef.current!;
    engine.reset();
    rendererRef.current?.reset();
    endedRef.current = false;
    setShowGameOver(false);
    setHud(engine.getHud());
  }, []);

  // ---- game loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    initAudio();
    startMusic();
    const engine = engineRef.current!;
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.resize(Math.max(320, rect.width), Math.max(240, rect.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let hitStopUntil = 0;

    const playFxSound = (e: FxEvent) => {
      switch (e.type) {
        case 'eat':
          sfx.eat(engine.chain.count);
          break;
        case 'chain': {
          const c = engine.chain.count;
          if (c >= 5) break; // the evolve climax already covers the 5th bite
          if (c === 3) sfx.mutate();
          else sfx.eat(c);
          break;
        }
        case 'evolve':
          if (e.gene) sfx.evolve5();
          else sfx.evolve();
          break;
        case 'shieldBreak':
          sfx.shield();
          break;
        case 'dash':
          sfx.dash();
          break;
        case 'magnet':
          sfx.magnet();
          break;
        case 'slow':
          sfx.slow();
          break;
        case 'shed':
          sfx.shed();
          break;
        case 'skill':
          sfx.skill();
          break;
        case 'upgrade':
          sfx.upgrade();
          break;
        case 'crown':
          sfx.crown();
          break;
        case 'deny':
          sfx.deny();
          break;
        case 'death':
          sfx.death();
          break;
        case 'eventStart':
          sfx.event();
          break;
        case 'secondLife':
          sfx.secondLife();
          break;
        case 'buff':
          sfx.buff();
          break;
        case 'debuff':
          sfx.debuff();
          break;
        case 'reaction':
          sfx.reaction();
          break;
        case 'bossSpawn':
          sfx.bossSpawn();
          break;
        case 'bossShoot':
          sfx.bossShoot();
          break;
        case 'bossHit':
          sfx.bossHit();
          break;
        case 'bossDeath':
          sfx.bossDeath();
          break;
        case 'playerShoot':
          sfx.playerShoot();
          break;
        case 'playerHit':
          sfx.playerHit();
          break;
        case 'minionSpawn':
          sfx.minionSpawn();
          break;
        case 'minionDeath':
          sfx.minionDeath();
          break;
        default:
          break;
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const reduced = settingsRef.current.reducedMotion;

      // hit-stop: on big moments the simulation freezes for a few frames while FX keep playing
      let fx: FxEvent[] = [];
      if (now >= hitStopUntil) {
        engine.update(dt);
        // keep BGM in sync with game phase (pause overlay, death, victory); setMusicPaused is idempotent
        setMusicPaused(!(engine.phase === 'playing' || engine.phase === 'upgrade'));
        fx = engine.drainFx();
        const headFx = engine.snake[0];
        for (const e of fx) {
          // anchor board-wide announcements to the head so the camera keeps them in view
          if (!e.pos && headFx && (e.type === 'eventStart' || e.type === 'upgrade' || e.type === 'evolve')) {
            e.pos = { x: headFx.x, y: headFx.y };
          }
          playFxSound(e);
          const hs = reduced ? 0 : HIT_STOP_MS[e.type];
          if (hs) hitStopUntil = Math.max(hitStopUntil, now + hs);
        }
      }
      renderer.handleFx(fx, reduced);
      renderer.render(engine, dt, { reducedMotion: reduced, time: now / 1000 });

      if ((engine.phase === 'dead' || engine.phase === 'victory') && !endedRef.current) {
        endedRef.current = true;
        onGameEnd(engine.score);
        window.setTimeout(() => setShowGameOver(true), engine.phase === 'dead' ? 1100 : 400);
      }

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(engine.getHud());
      }
    };
    raf = requestAnimationFrame(frame);
    setHud(engine.getHud());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // settings changes (mute / reduced motion) are read live via refs
  useEffect(() => {
    const engine = engineRef.current!;
    const keys = keysDown.current;
    const applySteer = () => {
      let sx = 0;
      let sy = 0;
      for (const k of keys) {
        const v = KEY_VEC[k];
        if (v) {
          sx += v.x;
          sy += v.y;
        }
      }
      engine.setSteer(sx, sy);
    };
    const handler = (e: KeyboardEvent) => {
      if (KEY_VEC[e.key]) {
        e.preventDefault();
        initAudio();
        if (!e.repeat) keys.add(e.key);
        applySteer();
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          initAudio();
          engine.useSkill();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          engine.togglePause();
          setHud(engine.getHud());
          break;
        case 'r':
        case 'R':
          if (engine.phase === 'dead' || engine.phase === 'victory') {
            e.preventDefault();
            restart();
          }
          break;
        default:
          break;
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (KEY_VEC[e.key]) {
        keys.delete(e.key);
        applySteer();
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);

    const onBlur = () => {
      keys.clear();
      engine.setSteer(0, 0);
      engine.setAttack(false);
      engine.pause();
      // rAF stops in hidden tabs, so duck the BGM here instead of relying on the frame loop
      setMusicPaused(true);
      setHud(engine.getHud());
    };
    window.addEventListener('blur', onBlur);
    // release the held mouse attack if the LEFT button goes up anywhere (e.g. dragged off-canvas)
    const onWindowMouseUp = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      engine.setAttack(false);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mouseup', onWindowMouseUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [restart]);

  // ---- touch swipe ----
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touchStart.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    initAudio();
    if (Math.abs(dx) > Math.abs(dy)) {
      engineRef.current!.enqueueDir(dx > 0 ? 'right' : 'left');
    } else {
      engineRef.current!.enqueueDir(dy > 0 ? 'down' : 'up');
    }
  };

  // ---- mouse attack: hold left button to attack; the direction always follows the snake head ----
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    initAudio();
    engineRef.current?.setAttack(true);
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    engineRef.current?.setAttack(false);
  };

  const engine = engineRef.current!;
  const phase = hud?.phase ?? 'playing';
  const chainColor = hud?.chain.color ?? null;
  const morph = hud ? morphSummary(hud.morph) : null;

  return (
    <div className="game-screen">
      {/* left panel */}
      <aside className="panel panel-left">
        <div className="stat-block score-block">
          <div className="stat-label">得分<span className="label-code">SCORE</span></div>
          <div className="stat-score">{(hud?.score ?? 0).toLocaleString()}</div>
          <div className="stat-sub">最高分 {Math.max(highScore, hud?.score ?? 0).toLocaleString()}</div>
        </div>

        <div className="stat-block">
          <div className="stat-label">基因连锁<span className="label-code">CHAIN</span></div>
          <InfoTip
            title="基因连锁"
            color={chainColor ? GENE_COLORS[chainColor] : COLORS.purple}
            desc={
              CHAIN_HELP +
              (hud?.chain.count
                ? `\n当前：${GENE_NAMES[hud.chain.color!]} ${hud.chain.count} 连（×${[1, 1.4, 1.8, 2.4, 3.2][Math.min(hud.chain.count, 5) - 1]}）`
                : '')
            }
          >
            {chainColor ? (
              <div className="chain-display" style={{ color: GENE_COLORS[chainColor] }}>
                <span className="chain-name">{GENE_NAMES[chainColor]}</span>
                <span className="chain-pips">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`pip ${i < (hud?.chain.count ?? 0) ? 'on' : ''}`} />
                  ))}
                </span>
                <span className="chain-count">{hud?.chain.count ?? 0} 连</span>
              </div>
            ) : (
              <div className="chain-empty">吞噬同色基因豆开始连锁</div>
            )}
          </InfoTip>
        </div>

        <div className="stat-block">
          <div className="stat-label">变异状态<span className="label-code">MORPH</span></div>
          <div className="effects-list">
            {morph && morph.stage > 0 && (
              <InfoTip
                title={`进化形态 · ${morph.name}`}
                color={morph.color}
                desc={
                  MORPH_HELP +
                  `\n当前：${morph.name} · ${MORPH_STAGE_NAMES[morph.stage]}（累计 ${morph.total} 次进化）` +
                  (morph.stage < MORPH_MAX_STAGE
                    ? '\n再完成 1 次 5 连进化即可进入下一阶段。'
                    : '\n已达究极形态。')
                }
              >
                <div className="effect-chip morph-chip" style={{ borderColor: morph.color, color: morph.color }}>
                  {morph.name} · {MORPH_STAGE_NAMES[morph.stage]}
                </div>
              </InfoTip>
            )}
            {hud && hud.effects.length > 0 ? (
              hud.effects.map((e) => (
                <InfoTip
                  key={e.kind}
                  title={`${EFFECT_LABELS[e.kind]}${DEBUFF_EFFECTS.has(e.kind) ? '（负面）' : ''}`}
                  color={EFFECT_COLORS[e.kind]}
                  desc={`${EFFECT_DESCS[e.kind]}\n剩余 ${e.remaining.toFixed(1)} / ${e.duration.toFixed(0)} 秒`}
                >
                  <div className={`effect-chip${DEBUFF_EFFECTS.has(e.kind) ? ' debuff' : ''}`}>
                    <span className="effect-name">{EFFECT_LABELS[e.kind]}</span>
                    <span className="effect-bar">
                      <span className="effect-fill" style={{ width: `${(e.remaining / e.duration) * 100}%` }} />
                    </span>
                  </div>
                </InfoTip>
              ))
            ) : (
              <div className="chain-empty">暂无变异</div>
            )}
            {hud && hud.shields > 0 && (
              <InfoTip
                title="相位护盾"
                color={COLORS.blue}
                desc={`抵挡自身碰撞：撞上身体时消耗 1 层护盾，蛇身从碰撞点截断并继续前进（无法抵挡撞墙）。\n当前 ${hud.shields} 层。`}
              >
                <div className="effect-chip shield-chip">相位护盾 ×{hud.shields}</div>
              </InfoTip>
            )}
            {hud?.clonePending && (
              <InfoTip title="复制豆" color={COLORS.purple} desc="下一颗吞噬的基因豆得分翻倍（额外结算一次同等分数）。">
                <div className="effect-chip clone-chip">复制豆生效中</div>
              </InfoTip>
            )}
            {hud?.hasSecondLife && !hud?.secondLifeUsed && (
              <InfoTip
                title="第二生命"
                color={COLORS.gold}
                desc="本局下一次致命碰撞将被抵消：蛇会原地冻结，转动方向到安全格子即可脱险。"
              >
                <div className="effect-chip life-chip">第二生命待触发</div>
              </InfoTip>
            )}
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">战斗<span className="label-code">COMBAT</span></div>
          {hud?.boss ? (
            <InfoTip
              title={`Boss · 阶段 ${hud.boss.phase}`}
              color={BOSS_ARROW_COLORS[hud.boss.phase]}
              desc={
                '固定式防御塔 Boss，只会攻击蛇头（弹幕可穿过蛇身）。\n' +
                `血量 ${Math.ceil(hud.boss.hp).toLocaleString()} / ${hud.boss.maxHp.toLocaleString()}，击杀奖励约 ${Math.round(hud.boss.anchorScore * 0.25).toLocaleString()} 分。\n` +
                '阶段 2 起召唤冲撞小怪，阶段 3 释放环形弹幕与虚弱特种弹。'
              }
            >
              <div className="boss-box">
                <div className="boss-name" style={{ color: BOSS_ARROW_COLORS[hud.boss.phase] }}>
                  BOSS · 阶段 {hud.boss.phase}
                </div>
                <div className="effect-bar boss-bar">
                  <span
                    className="effect-fill"
                    style={{
                      width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%`,
                      background: BOSS_ARROW_COLORS[hud.boss.phase],
                    }}
                  />
                </div>
                <div className="boss-hp-text">
                  {Math.ceil(hud.boss.hp).toLocaleString()} / {hud.boss.maxHp.toLocaleString()}
                </div>
              </div>
            </InfoTip>
          ) : (
            <InfoTip
              title="Boss 阈值"
              color={COLORS.red}
              desc={`分数每达到 ${BOSS_STEP.toLocaleString()} 的整数倍时刷新一次 Boss（每个阈值仅一次）。\n下一个阈值：${(hud?.nextBossAt ?? BOSS_STEP).toLocaleString()} 分。`}
            >
              <div className="chain-empty">
                下一个 Boss：{(hud?.nextBossAt ?? BOSS_STEP).toLocaleString()} 分
              </div>
            </InfoTip>
          )}
          <InfoTip
            title={`攻击形态 · ${ATTACK_FORM_NAMES[hud?.attackForm ?? 'none']}`}
            color={ATTACK_FORM_COLORS[hud?.attackForm ?? 'none']}
            desc={
              '按住鼠标左键沿蛇头朝向攻击（键盘负责转向）。\n' +
              ATTACK_FORM_DESCS[hud?.attackForm ?? 'none'] +
              '\n元素附著/融合反应与黄金时刻会进一步放大攻击伤害（上限 ×5）。'
            }
          >
            <div className="attack-hint" style={{ borderColor: ATTACK_FORM_COLORS[hud?.attackForm ?? 'none'] }}>
              <b style={{ color: ATTACK_FORM_COLORS[hud?.attackForm ?? 'none'] }}>
                {ATTACK_FORM_NAMES[hud?.attackForm ?? 'none']}
              </b>
              <span>按住鼠标左键攻击</span>
            </div>
          </InfoTip>
        </div>

        <div className="stat-block">
          <div className="stat-label">主动技能<span className="label-code">SKILL</span></div>
          {hud?.skill ? (
            <InfoTip
              title={SKILL_NAMES[hud.skill.kind]}
              color={COLORS.gold}
              desc={`${SKILL_DESCS[hud.skill.kind]}\n当前充能 ${hud.skill.charges} 次，按空格释放。`}
            >
              <div className="skill-box">
                <div className="skill-name">{skillName(hud.skill.kind)}</div>
                <div className="skill-charges">
                  {Array.from({ length: Math.max(hud.skill.charges, 0) }, (_, i) => (
                    <span key={i} className="charge" />
                  ))}
                  <span className="charges-text">{hud.skill.charges} 次</span>
                </div>
                <div className="skill-hint">按 空格 释放</div>
              </div>
            </InfoTip>
          ) : (
            <div className="chain-empty">吞噬金色技能豆获得</div>
          )}
        </div>

        {hud?.activeEvent && (
          <div className="stat-block event-block">
            <InfoTip
              title={`⚡ ${EVENT_DEFS[hud.activeEvent.kind].name}`}
              color={COLORS.gold}
              desc={`${EVENT_DEFS[hud.activeEvent.kind].desc}\n剩余 ${hud.activeEvent.remaining.toFixed(1)} 秒`}
            >
              <div className="event-name">⚡ {EVENT_DEFS[hud.activeEvent.kind].name}</div>
            </InfoTip>
            <div className="event-desc">{EVENT_DEFS[hud.activeEvent.kind].desc}</div>
            <div className="effect-bar">
              <span
                className="effect-fill"
                style={{ width: `${(hud.activeEvent.remaining / hud.activeEvent.duration) * 100}%` }}
              />
            </div>
          </div>
        )}
      </aside>

      {/* board */}
      <main className="board-area">
        <div
          className="board-wrap"
          ref={wrapRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchMove={(e) => e.preventDefault()}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={canvasRef} className="game-canvas" />

          {phase === 'paused' && (
            <div className="overlay">
              <div className="overlay-title">已暂停</div>
              <button className="btn-primary" onClick={() => { engine.resume(); setHud(engine.getHud()); }}>
                继续游戏
              </button>
              <button className="btn-ghost" onClick={onExit}>
                返回主菜单
              </button>
            </div>
          )}

          {phase === 'upgrade' && hud && (
            <UpgradeModal
              choices={hud.upgradeChoices}
              onChoose={(id: UpgradeId) => {
                engine.chooseUpgrade(id);
                setHud(engine.getHud());
              }}
            />
          )}

          {showGameOver && hud && (
            <GameOverModal
              stats={hud.stats}
              highScore={Math.max(highScore, hud.score)}
              isNewRecord={hud.score > highScore && highScore > 0}
              victory={hud.phase === 'victory'}
              onRestart={restart}
              onExit={onExit}
            />
          )}
        </div>

        {/* mobile controls */}
        <div className="touch-controls">
          <div className="dpad">
            <button className="dpad-btn up" onClick={() => engine.enqueueDir('up')}>▲</button>
            <button className="dpad-btn left" onClick={() => engine.enqueueDir('left')}>◀</button>
            <button className="dpad-btn right" onClick={() => engine.enqueueDir('right')}>▶</button>
            <button className="dpad-btn down" onClick={() => engine.enqueueDir('down')}>▼</button>
          </div>
          <div className="touch-actions">
            <button
              className="skill-btn"
              onClick={() => { initAudio(); engine.useSkill(); }}
              disabled={!hud?.skill}
            >
              {hud?.skill ? `${skillName(hud.skill.kind)} (${hud.skill.charges})` : '无技能'}
            </button>
            <button
              className="pause-btn"
              onClick={() => { engine.togglePause(); setHud(engine.getHud()); }}
            >
              {phase === 'paused' ? '继续' : '暂停'}
            </button>
          </div>
        </div>
      </main>

      {/* right panel */}
      <aside className="panel panel-right">
        <div className="stat-block">
          <div className="stat-label">本局强化<span className="label-code">UPGRADES</span></div>
          <div className="upgrades-list">
            {hud && hud.upgrades.length > 0 ? (
              hud.upgrades.map((u) => (
                <InfoTip
                  key={u.id}
                  title={`${UPGRADE_MAP[u.id].name} · Lv.${u.level}/${UPGRADE_MAP[u.id].maxLevel}`}
                  color={schoolColor(UPGRADE_MAP[u.id].school)}
                  desc={UPGRADE_MAP[u.id].desc}
                >
                  <div className={`upgrade-chip school-${UPGRADE_MAP[u.id].school}`}>
                    <span className="up-name">{UPGRADE_MAP[u.id].name}</span>
                    <span className="up-lvl">Lv.{u.level}</span>
                  </div>
                </InfoTip>
              ))
            ) : (
              <div className="chain-empty">达到分数里程碑后三选一</div>
            )}
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">蛇身<span className="label-code">SNAKE</span></div>
          <div className="stat-row">
            <span>长度</span>
            <b>{hud?.snakeLength ?? 3}</b>
          </div>
          <div className="stat-row">
            <span>最长</span>
            <b>{hud?.stats.maxLength ?? 3}</b>
          </div>
          <div className="stat-row">
            <span>进化次数</span>
            <b>{hud?.stats.evolutions ?? 0}</b>
          </div>
        </div>

        <div className="stat-block tips">
          <div className="stat-label">基因指南<span className="label-code">GUIDE</span></div>
          <div className="tip" style={{ borderColor: COLORS.red }}>
            <b style={{ color: COLORS.red }}>红 · 狂热</b> 连吃提升得分倍率，5 连进入赤焰形态
          </div>
          <div className="tip" style={{ borderColor: COLORS.blue }}>
            <b style={{ color: COLORS.blue }}>蓝 · 幻影</b> 减速与相位护盾，抵挡自身碰撞
          </div>
          <div className="tip" style={{ borderColor: COLORS.green }}>
            <b style={{ color: COLORS.green }}>绿 · 蜕变</b> 代谢缩短蛇尾，控制生长换取空间
          </div>
          <div className="tip" style={{ borderColor: COLORS.gold }}>
            <b style={{ color: COLORS.gold }}>彩虹豆</b> 延续当前连锁 · <b style={{ color: COLORS.purple }}>复制豆</b> 双倍下一豆
          </div>
          <div className="tip" style={{ borderColor: '#FF8A3D' }}>
            <b style={{ color: '#FF8A3D' }}>元素反应</b> 炎/霜/雷单吃附著增益，连吃两种不同元素触发融化·超载·超导
          </div>
          <div className="tip" style={{ borderColor: COLORS.red }}>
            <b style={{ color: COLORS.red }}>危险豆（尖刺光环）</b> 加速/迷雾/虚弱/腐蚀需避开；<b style={{ color: COLORS.blue }}>护盾</b>·<b style={{ color: COLORS.green }}>净化</b>豆有益
          </div>
          <div className="tip" style={{ borderColor: '#7C8DB5' }}>
            <b style={{ color: '#A9BADB' }}>废墟石板</b> 撞上即死，但能挡住弹幕——善用它做掩体
          </div>
          <div className="tip" style={{ borderColor: '#FF9A3D' }}>
            <b style={{ color: '#FF9A3D' }}>野外个体</b> 平时也会游荡袭来，击杀掉落基因豆；Boss 会游走包抄，别被贴脸
          </div>
        </div>
      </aside>
    </div>
  );
}

function skillName(kind: string): string {
  const names: Record<string, string> = {
    dash: '极速冲刺',
    magnet: '基因磁吸',
    slow: '时间缓流',
    shed: '断尾蜕皮',
  };
  return names[kind] ?? kind;
}

function schoolColor(school: string): string {
  const map: Record<string, string> = {
    red: COLORS.red,
    blue: COLORS.blue,
    green: COLORS.green,
    chain: COLORS.purple,
    general: COLORS.gold,
  };
  return map[school] ?? COLORS.gold;
}
