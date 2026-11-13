import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { Renderer } from '../game/renderer';
import { initAudio, sfx } from '../game/audio';
import { COLORS, EFFECT_LABELS, EVENT_DEFS, GENE_COLORS, GENE_NAMES, UPGRADE_MAP } from '../game/config';
import type { FxEvent, HudState, UpgradeId } from '../game/types';
import type { Settings } from '../game/storage';
import UpgradeModal from './UpgradeModal';
import GameOverModal from './GameOverModal';

interface Props {
  highScore: number;
  settings: Settings;
  onGameEnd: (score: number) => void;
  onExit: () => void;
}

const KEY_DIRS: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
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
    const engine = engineRef.current!;
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const size = Math.max(240, Math.min(rect.width, rect.height));
      renderer.resize(size);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const playFxSound = (e: FxEvent) => {
      switch (e.type) {
        case 'eat':
          sfx.eat(engine.chain.count);
          break;
        case 'chain':
          sfx.eat(engine.chain.count + 1);
          break;
        case 'evolve':
          sfx.evolve();
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
        default:
          break;
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      engine.update(dt);
      const fx = engine.drainFx();
      for (const e of fx) playFxSound(e);
      const reduced = settingsRef.current.reducedMotion;
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // settings changes (mute / reduced motion) are read live via refs
  useEffect(() => {
    const engine = engineRef.current!;
    const handler = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key];
      if (dir) {
        e.preventDefault();
        initAudio();
        engine.enqueueDir(dir);
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
    window.addEventListener('keydown', handler);

    const onBlur = () => {
      engine.pause();
      setHud(engine.getHud());
    };
    window.addEventListener('blur', onBlur);
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('blur', onBlur);
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

  const engine = engineRef.current!;
  const phase = hud?.phase ?? 'playing';
  const chainColor = hud?.chain.color ?? null;

  return (
    <div className="game-screen">
      {/* left panel */}
      <aside className="panel panel-left">
        <div className="stat-block">
          <div className="stat-label">得分</div>
          <div className="stat-score">{(hud?.score ?? 0).toLocaleString()}</div>
          <div className="stat-sub">最高分 {Math.max(highScore, hud?.score ?? 0).toLocaleString()}</div>
        </div>

        <div className="stat-block">
          <div className="stat-label">基因连锁</div>
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
        </div>

        <div className="stat-block">
          <div className="stat-label">变异状态</div>
          <div className="effects-list">
            {hud && hud.effects.length > 0 ? (
              hud.effects.map((e) => (
                <div key={e.kind} className="effect-chip">
                  <span className="effect-name">{EFFECT_LABELS[e.kind]}</span>
                  <span className="effect-bar">
                    <span className="effect-fill" style={{ width: `${(e.remaining / e.duration) * 100}%` }} />
                  </span>
                </div>
              ))
            ) : (
              <div className="chain-empty">暂无变异</div>
            )}
            {hud && hud.shields > 0 && <div className="effect-chip shield-chip">相位护盾 ×{hud.shields}</div>}
            {hud?.clonePending && <div className="effect-chip clone-chip">复制豆生效中</div>}
            {hud?.hasSecondLife && !hud?.secondLifeUsed && (
              <div className="effect-chip life-chip">第二生命待触发</div>
            )}
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">主动技能</div>
          {hud?.skill ? (
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
          ) : (
            <div className="chain-empty">吞噬金色技能豆获得</div>
          )}
        </div>

        {hud?.activeEvent && (
          <div className="stat-block event-block">
            <div className="event-name">⚡ {EVENT_DEFS[hud.activeEvent.kind].name}</div>
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
          <div className="stat-label">本局强化</div>
          <div className="upgrades-list">
            {hud && hud.upgrades.length > 0 ? (
              hud.upgrades.map((u) => (
                <div key={u.id} className={`upgrade-chip school-${UPGRADE_MAP[u.id].school}`}>
                  <span className="up-name">{UPGRADE_MAP[u.id].name}</span>
                  <span className="up-lvl">Lv.{u.level}</span>
                </div>
              ))
            ) : (
              <div className="chain-empty">达到分数里程碑后三选一</div>
            )}
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">蛇身</div>
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
          <div className="stat-label">基因指南</div>
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
