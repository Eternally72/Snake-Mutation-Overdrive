import type { RunStats } from '../game/types';
import { UPGRADE_MAP } from '../game/config';

interface Props {
  stats: RunStats;
  highScore: number;
  isNewRecord: boolean;
  victory: boolean;
  onRestart: () => void;
  onExit: () => void;
}

export default function GameOverModal({ stats, highScore, isNewRecord, victory, onRestart, onExit }: Props) {
  return (
    <div className="overlay gameover-overlay">
      <div className="overlay-title">{victory ? '完美进化！' : '基因崩溃'}</div>
      {victory && <div className="overlay-sub">你填满了整个棋盘！</div>}
      {isNewRecord && <div className="new-record">✦ 新纪录 ✦</div>}

      <div className="final-score">{stats.score.toLocaleString()}</div>
      <div className="final-label">本局得分 · 最高分 {highScore.toLocaleString()}</div>

      <div className="final-grid">
        <div className="final-item">
          <span>生存时间</span>
          <b>{formatTime(stats.timeAlive)}</b>
        </div>
        <div className="final-item">
          <span>最长蛇身</span>
          <b>{stats.maxLength}</b>
        </div>
        <div className="final-item">
          <span>最大连锁</span>
          <b>{stats.maxChain} 连</b>
        </div>
        <div className="final-item">
          <span>完全进化</span>
          <b>{stats.evolutions} 次</b>
        </div>
      </div>

      {stats.upgrades.length > 0 && (
        <div className="final-upgrades">
          {stats.upgrades.map((u) => (
            <span key={u.id} className={`upgrade-chip school-${UPGRADE_MAP[u.id].school}`}>
              {UPGRADE_MAP[u.id].name} Lv.{u.level}
            </span>
          ))}
        </div>
      )}

      <div className="final-actions">
        <button className="btn-primary" onClick={onRestart}>
          再来一局 (R)
        </button>
        <button className="btn-ghost" onClick={onExit}>
          返回主菜单
        </button>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
