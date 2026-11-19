import { useEffect, useRef } from 'react';

interface Props {
  highScore: number;
  onStart: () => void;
  onOpenSettings: () => void;
}

const SEG_COLORS = ['#FF5365', '#FF5365', '#FFC857', '#4EF1A3', '#4EF1A3', '#43BFFF', '#43BFFF', '#B176FF'];

function useStartBackground(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const snakes = [
      { y: 0.24, amp: 34, freq: 0.012, speed: 62, segs: 26, phase: 0, hueShift: 0 },
      { y: 0.55, amp: 46, freq: 0.009, speed: 44, segs: 32, phase: 2.2, hueShift: 2 },
      { y: 0.82, amp: 28, freq: 0.015, speed: 78, segs: 22, phase: 4.1, hueShift: 4 },
    ];
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      a: 0.1 + Math.random() * 0.35,
      tw: 0.5 + Math.random() * 2,
    }));

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = now / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.fillStyle = '#090E1A';
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * s.tw));
        ctx.fillStyle = '#43BFFF';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const snake of snakes) {
        const baseY = snake.y * h;
        const headX = ((t * snake.speed + snake.phase * 200) % (w + 400)) - 200;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = snake.segs - 1; i >= 0; i--) {
          const x = headX - i * 16;
          const y = baseY + Math.sin(x * snake.freq + t * 2 + snake.phase) * snake.amp;
          const color = SEG_COLORS[(i + snake.hueShift) % SEG_COLORS.length];
          const r = i === 0 ? 10 : Math.max(3, 8.5 - i * 0.16);
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = i === 0 ? 22 : 10;
          ctx.fillStyle = color;
          ctx.globalAlpha = i === 0 ? 0.95 : 0.72;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}

export default function StartScreen({ highScore, onStart, onOpenSettings }: Props) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  useStartBackground(bgRef as React.RefObject<HTMLCanvasElement>);
  return (
    <div className="start-screen">
      <canvas ref={bgRef} className="start-bg" />
      <div className="start-content">
        <div className="start-badge">
          <span className="badge-dot" /> 实验体 OVD-01 // 基因吞噬 · 连续进化
        </div>
        <h1 className="start-title">
          <span className="title-snake">贪吃蛇</span>
          <span className="title-colon">：</span>
          <span className="title-mutation">失控进化</span>
        </h1>
        <div className="start-subtitle">SNAKE : MUTATION OVERDRIVE</div>

        <div className="gene-legend">
          <div className="gene-item gene-red">
            <span className="gene-dot" /> 狂热 · 高分爆发 <span className="gene-code">G-01</span>
          </div>
          <div className="gene-item gene-blue">
            <span className="gene-dot" /> 幻影 · 护盾减速 <span className="gene-code">G-02</span>
          </div>
          <div className="gene-item gene-green">
            <span className="gene-dot" /> 蜕变 · 生长重构 <span className="gene-code">G-03</span>
          </div>
        </div>

        <button className="btn-primary start-btn" onClick={onStart}>
          开始进化
        </button>

        <div className="start-help">
          <div>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd> / <kbd>WASD</kbd> 移动
          </div>
          <div>
            <kbd>空格</kbd> 技能 · <kbd>P</kbd> 暂停 · <kbd>R</kbd> 重开
          </div>
          <div className="help-tip">连续吞噬同色基因豆，触发变异进化！</div>
        </div>

        <div className="start-footer">
          <span className="highscore-chip">最高分 <b>{highScore.toLocaleString()}</b></span>
          <button className="btn-ghost" onClick={onOpenSettings}>
            ⚙ 设置
          </button>
        </div>
      </div>
    </div>
  );
}
