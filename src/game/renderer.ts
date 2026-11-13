import { COLORS, GENE_COLORS, GRID, MAX_PARTICLES } from './config';
import type { GameEngine } from './engine';
import type { FxEvent, GeneColor } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'dot' | 'ring' | 'shard';
  spin?: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface RenderOptions {
  reducedMotion: boolean;
  time: number; // seconds, wall clock for animations
}

const AMBIENT_COUNT = 14;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private rings: Ring[] = [];
  private ambient: { x: number; y: number; vy: number; a: number; s: number }[] = [];
  private shake = { mag: 0, remaining: 0 };
  private flash = { alpha: 0, color: '#ffffff', decay: 0 };
  private deathFade = 0;
  private deathAnimating = false;
  private headPulse = 0;
  private bgPulse = 0;
  private cell = 30;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      this.ambient.push({
        x: Math.random(),
        y: Math.random(),
        vy: 0.005 + Math.random() * 0.012,
        a: 0.05 + Math.random() * 0.12,
        s: 0.5 + Math.random() * 1.4,
      });
    }
  }

  resize(sizePx: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(sizePx * dpr);
    this.canvas.height = Math.round(sizePx * dpr);
    this.canvas.style.width = `${sizePx}px`;
    this.canvas.style.height = `${sizePx}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = sizePx / GRID;
  }

  reset() {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.shake = { mag: 0, remaining: 0 };
    this.flash = { alpha: 0, color: '#fff', decay: 0 };
    this.deathFade = 0;
    this.deathAnimating = false;
  }

  handleFx(events: FxEvent[], reducedMotion: boolean) {
    const scale = reducedMotion ? 0.3 : 1;
    for (const e of events) {
      const px = e.pos ? (e.pos.x + 0.5) * this.cell : this.cell * GRID * 0.5;
      const py = e.pos ? (e.pos.y + 0.5) * this.cell : this.cell * GRID * 0.5;
      switch (e.type) {
        case 'eat':
          this.burst(px, py, e.color ?? COLORS.green, Math.round((e.count ?? 8) * scale), 90);
          if (e.text) this.popup(px, py, e.text, e.color ?? COLORS.text, e.big ? 20 : 15);
          this.headPulse = 1;
          break;
        case 'chain':
          this.burst(px, py, this.geneColor(e.gene), Math.round((e.count ?? 12) * scale), 130);
          this.ring(px, py, this.cell * 0.4, this.cell * (1.4 + (e.count ?? 0) * 0.2), this.geneColor(e.gene), 0.4);
          if (e.text) this.popup(px, py - this.cell * 0.4, e.text, this.geneColor(e.gene), e.big ? 22 : 17);
          this.bgPulse = Math.min(1, this.bgPulse + 0.4);
          break;
        case 'evolve':
          this.burst(px, py, this.geneColor(e.gene) ?? e.color ?? COLORS.purple, Math.round((e.count ?? 36) * scale), 220);
          this.ring(px, py, this.cell * 0.5, this.cell * 6, this.geneColor(e.gene) ?? e.color ?? COLORS.purple, 0.7, 5);
          if (e.text) this.popup(px, py - this.cell * 0.6, e.text, this.geneColor(e.gene) ?? COLORS.gold, 24);
          if (!reducedMotion) {
            this.shake.mag = 5;
            this.shake.remaining = 0.3;
            this.flash.alpha = 0.28;
            this.flash.color = this.geneColor(e.gene) ?? COLORS.gold;
            this.flash.decay = 1.6;
          }
          break;
        case 'shieldBreak':
          this.burst(px, py, COLORS.blue, Math.round(24 * scale), 160);
          this.ring(px, py, this.cell * 0.5, this.cell * 2.4, COLORS.blue, 0.45, 4);
          break;
        case 'dash':
          this.burst(px, py, COLORS.gold, Math.round(20 * scale), 200);
          break;
        case 'magnet':
          this.ring(px, py, this.cell * 0.5, this.cell * 4.5, COLORS.purple, 0.6, 3);
          break;
        case 'slow':
          this.ring(px, py, this.cell * 0.5, this.cell * 5, COLORS.blue, 0.6, 3);
          break;
        case 'shed':
          this.burst(px, py, COLORS.green, Math.round((e.count ?? 20) * scale), 140);
          if (e.text) this.popup(px, py, e.text, COLORS.green, 16);
          break;
        case 'skill':
          this.burst(px, py, COLORS.gold, Math.round(16 * scale), 120);
          if (e.text) this.popup(px, py - this.cell * 0.5, e.text, COLORS.gold, 16);
          break;
        case 'upgrade':
          this.burst(px, py, COLORS.gold, Math.round(18 * scale), 150);
          if (e.text) this.popup(this.cell * GRID * 0.5, this.cell * GRID * 0.4, e.text, COLORS.gold, 20);
          break;
        case 'crown':
          if (e.pos) {
            this.ring(px, py, this.cell * 0.3, this.cell * 3, COLORS.gold, 0.5, 3);
            this.burst(px, py, COLORS.gold, Math.round(14 * scale), 110);
          }
          break;
        case 'secondLife':
          this.burst(px, py, COLORS.gold, Math.round(36 * scale), 200);
          this.ring(px, py, this.cell * 0.5, this.cell * 4, COLORS.gold, 0.6, 5);
          if (!reducedMotion) {
            this.flash.alpha = 0.35;
            this.flash.color = COLORS.gold;
            this.flash.decay = 1.4;
          }
          break;
        case 'death':
          this.deathAnimating = true;
          this.deathFade = 0;
          if (!reducedMotion) {
            this.shake.mag = 8;
            this.shake.remaining = 0.45;
            this.flash.alpha = 0.4;
            this.flash.color = '#FF5365';
            this.flash.decay = 2.2;
          }
          break;
        case 'eventStart':
          this.popup(this.cell * GRID * 0.5, this.cell * GRID * 0.32, e.text ?? '事件', COLORS.gold, 22);
          break;
        case 'deny':
          break;
        default:
          break;
      }
    }
  }

  private geneColor(gene?: GeneColor | string): string {
    if (gene === 'red' || gene === 'blue' || gene === 'green') return GENE_COLORS[gene];
    return COLORS.gold;
  }

  private burst(x: number, y: number, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        maxLife: life,
        size: 1.5 + Math.random() * 2.5,
        color,
        kind: Math.random() < 0.15 ? 'shard' : 'dot',
        spin: Math.random() * 6,
      });
    }
  }

  private ring(x: number, y: number, r0: number, maxR: number, color: string, life: number, width = 3) {
    this.rings.push({ x, y, r: r0, maxR, life, maxLife: life, color, width });
  }

  private popup(x: number, y: number, text: string, color: string, size: number) {
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x, y, text, life: 0.9, maxLife: 0.9, color, size });
  }

  render(engine: GameEngine, dt: number, opts: RenderOptions) {
    const ctx = this.ctx;
    const size = this.cell * GRID;
    const t = opts.time;

    // ---- update fx state ----
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 26 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      const k = 1 - r.life / r.maxLife;
      r.r = r.r + (r.maxR - r.r) * Math.min(1, dt * 8);
      void k;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    this.headPulse = Math.max(0, this.headPulse - dt * 4);
    this.bgPulse = Math.max(0, this.bgPulse - dt * 1.4);
    if (this.shake.remaining > 0) this.shake.remaining -= dt;
    if (this.flash.alpha > 0) this.flash.alpha = Math.max(0, this.flash.alpha - this.flash.decay * dt);
    if (this.deathAnimating) this.deathFade = Math.min(0.6, this.deathFade + dt * 1.4);
    else this.deathFade = Math.max(0, this.deathFade - dt * 2);
    for (const a of this.ambient) {
      a.y -= a.vy * dt;
      if (a.y < -0.02) {
        a.y = 1.02;
        a.x = Math.random();
      }
    }

    ctx.save();
    // screen shake
    if (this.shake.remaining > 0 && !opts.reducedMotion) {
      const m = this.shake.mag * (this.shake.remaining / 0.45);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    // ---- board ----
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-10, -10, size + 20, size + 20);
    const bgBoost = this.bgPulse * 0.1;
    ctx.fillStyle = COLORS.board;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, size, size);
    if (bgBoost > 0) {
      ctx.fillStyle = COLORS.purple;
      ctx.globalAlpha = bgBoost;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    // grid
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      ctx.moveTo(i * this.cell, 0);
      ctx.lineTo(i * this.cell, size);
      ctx.moveTo(0, i * this.cell);
      ctx.lineTo(size, i * this.cell);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ambient particles
    if (!opts.reducedMotion) {
      for (const a of this.ambient) {
        ctx.fillStyle = COLORS.blue;
        ctx.globalAlpha = a.a;
        ctx.beginPath();
        ctx.arc(a.x * size, a.y * size, a.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // event tints
    if (engine.activeEvent?.kind === 'goldenTime') {
      ctx.fillStyle = COLORS.gold;
      ctx.globalAlpha = 0.05 + 0.02 * Math.sin(t * 4);
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }
    if (engine.hasEffect('slow') || engine.hasEffect('condense') || engine.hasEffect('afterimage')) {
      ctx.fillStyle = COLORS.blue;
      ctx.globalAlpha = 0.06;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    // ---- beans ----
    for (const bean of engine.beans) {
      this.drawBean(bean.kind, (bean.pos.x + 0.5) * this.cell, (bean.pos.y + 0.5) * this.cell, t, opts.reducedMotion);
    }

    // ---- snake ----
    this.drawSnake(engine, t, opts);

    // ---- rings, particles, popups ----
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = r.width * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.spin ?? 0) + t * 6);
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    for (const p of this.popups) {
      const a = Math.min(1, p.life / (p.maxLife * 0.5));
      ctx.globalAlpha = a;
      ctx.font = `bold ${p.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // border glow
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(67,191,255,0.35)');
    grad.addColorStop(0.5, 'rgba(177,118,255,0.25)');
    grad.addColorStop(1, 'rgba(78,241,163,0.35)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    // death fade
    if (this.deathFade > 0) {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = this.deathFade;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    // flash
    if (this.flash.alpha > 0 && !opts.reducedMotion) {
      ctx.fillStyle = this.flash.color;
      ctx.globalAlpha = this.flash.alpha;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawBean(kind: string, x: number, y: number, t: number, reducedMotion: boolean) {
    const ctx = this.ctx;
    const pulse = reducedMotion ? 1 : 1 + 0.12 * Math.sin(t * 5 + x * 0.1 + y * 0.1);
    const r = this.cell * 0.3 * pulse;
    let color = COLORS.gold;
    if (kind === 'red' || kind === 'blue' || kind === 'green') color = GENE_COLORS[kind as GeneColor];
    else if (kind === 'rainbow') color = `hsl(${(t * 140) % 360}, 90%, 65%)`;
    else if (kind === 'clone') color = COLORS.purple;
    else if (kind === 'crown') color = COLORS.gold;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = reducedMotion ? 4 : 12;
    if (kind === 'skill') {
      // gold diamond
      ctx.translate(x, y);
      ctx.rotate(t * 1.5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r * 1.2, 0);
      ctx.lineTo(0, r * 1.2);
      ctx.lineTo(-r * 1.2, 0);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'crown') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // rays
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4);
        ctx.lineTo(x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'clone') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y, r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y, r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'rainbow') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.25, t * 3, t * 3 + Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSnake(engine: GameEngine, t: number, opts: RenderOptions) {
    const ctx = this.ctx;
    const snake = engine.snake;
    if (snake.length === 0) return;
    const prog = engine.stepProgress();
    const c = this.cell;

    const flame = engine.hasEffect('flame');
    const ghost = engine.hasEffect('ghost');
    const alien = engine.hasEffect('alien');
    const berserk = engine.hasEffect('berserk');

    // interpolated positions
    const pts: { x: number; y: number }[] = snake.map((seg, i) => {
      const prev = engine.prevSnake[i] ?? engine.prevSnake[engine.prevSnake.length - 1] ?? seg;
      return {
        x: (prev.x + (seg.x - prev.x) * prog + 0.5) * c,
        y: (prev.y + (seg.y - prev.y) * prog + 0.5) * c,
      };
    });

    ctx.save();
    if (ghost) ctx.globalAlpha = 0.55;

    // body glow pass
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = pts.length - 1; i >= 0; i--) {
        if (i === pts.length - 1) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (pass === 0) {
        ctx.strokeStyle = flame ? 'rgba(255,120,60,0.16)' : 'rgba(80,140,255,0.10)';
        ctx.lineWidth = c * 1.05;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = c * 0.5;
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // segments tail -> head so head draws on top
    for (let i = pts.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const p = pts[i];
      const isHead = i === 0;
      const color = GENE_COLORS[seg.color];
      const shrink = Math.min(1, 0.72 + 0.28 * (1 - i / Math.max(1, pts.length - 1)));
      let r = (isHead ? c * 0.46 : c * 0.38) * shrink;
      if (isHead) r *= 1 + this.headPulse * 0.25;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = opts.reducedMotion ? 4 : flame ? 18 : berserk ? 14 : 9;
      ctx.fillStyle = color;
      if (alien) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, '#EAFFF4');
        g.addColorStop(0.5 + 0.2 * Math.sin(t * 6 - i * 0.5), color);
        g.addColorStop(1, '#1FAF6A');
        ctx.fillStyle = g;
      }
      if (flame && isHead) {
        ctx.fillStyle = '#FFB060';
        ctx.shadowColor = '#FF7030';
        ctx.shadowBlur = 24;
      }
      // rounded segment
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      // connective bridge to next segment toward tail
      if (i < pts.length - 1) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 1.55;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
      ctx.restore();

      if (isHead) {
        // eyes
        const d = engine.dir;
        const ex = d === 'left' ? -1 : d === 'right' ? 1 : 0;
        const ey = d === 'up' ? -1 : d === 'down' ? 1 : 0;
        const px = -ey;
        const py = ex;
        ctx.save();
        ctx.fillStyle = '#0A0F1C';
        const eo = r * 0.42;
        ctx.beginPath();
        ctx.arc(p.x + ex * eo * 0.7 + px * eo, p.y + ey * eo * 0.7 + py * eo, r * 0.17, 0, Math.PI * 2);
        ctx.arc(p.x + ex * eo * 0.7 - px * eo, p.y + ey * eo * 0.7 - py * eo, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // shield halo
        if (engine.shields > 0) {
          ctx.save();
          ctx.strokeStyle = COLORS.blue;
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6);
          ctx.lineWidth = 2;
          ctx.shadowColor = COLORS.blue;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 5 + engine.shields, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // magnet field
        if (engine.hasEffect('magnet')) {
          ctx.save();
          ctx.strokeStyle = COLORS.purple;
          ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 8);
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = -t * 30;
          ctx.beginPath();
          ctx.arc(p.x, p.y, c * 4.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
}
