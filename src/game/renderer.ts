import { BEAN_COLORS, BOSS_ARROW_COLORS, BOSS_ARROW_FADE, BOSS_TELEGRAPH, BULLET_MUZZLE, COLORS, EFFECT_COLORS, GENE_COLORS, GRID, MORPH_DEFS, MAX_PARTICLES, PRISM_COLUMN_OFFSET, VIEW, VIEW_W, morphSummary } from './config';
import type { GameEngine } from './engine';
import type { EffectKind, FxEvent, GeneColor } from './types';

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

// ---- persistent buff auras: one visual identity per effect, freely stackable ----
type RingStyle = 'dash' | 'pulse' | 'orbit';
type EmitKind = 'ember' | 'spark' | 'smoke' | 'snow' | 'wisp' | 'streak';
interface AuraDef {
  ring?: RingStyle; // head ring style
  tint?: number; // additive body tint alpha
  emit?: EmitKind; // throttled head particle trail
}

const AURA_DEF: Partial<Record<EffectKind, AuraDef>> = {
  flame: { ring: 'pulse', tint: 0.1, emit: 'ember' },
  burn: { emit: 'ember' },
  berserk: { ring: 'pulse', tint: 0.08, emit: 'streak' },
  condense: { ring: 'dash', tint: 0.05 },
  afterimage: { ring: 'dash', emit: 'snow' },
  ghost: { tint: 0.07, emit: 'wisp' },
  alien: { tint: 0.09, emit: 'wisp' },
  magnet: { ring: 'orbit' },
  slow: { ring: 'dash', tint: 0.06 },
  resonanceBoost: { ring: 'orbit', tint: 0.08, emit: 'spark' },
  haste: { emit: 'streak' },
  fog: { emit: 'smoke' },
  weak: { emit: 'smoke' },
  fireAtk: { ring: 'pulse', tint: 0.06, emit: 'ember' },
  iceArmor: { ring: 'dash', tint: 0.05, emit: 'snow' },
  charged: { ring: 'orbit', tint: 0.05, emit: 'spark' },
  melt: { ring: 'pulse', tint: 0.07, emit: 'ember' },
  overload: { ring: 'orbit', tint: 0.06, emit: 'spark' },
  superconduct: { ring: 'dash', tint: 0.06, emit: 'snow' },
};

const AURA_EMIT_INTERVAL = 0.13;

interface MorphDrawCtx {
  stage: number;
  head: { x: number; y: number };
  tail: { x: number; y: number };
  ang: number;
  tailAng: number;
  pts: { x: number; y: number }[];
  visible: (p: { x: number; y: number }) => boolean;
  t: number;
  opts: RenderOptions;
  pal: { primary: string; secondary: string; glow: string };
}

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
  private auraAccum = 0;
  private arrowAlpha = 0;
  private cell = 30;
  private viewW = 800;
  private viewH = 600;
  // letterbox offsets: world viewport is centered when the canvas aspect drifts from 4:3
  private ox = 0;
  private oy = 0;
  private headPx = 300;
  private headPy = 300;

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

  resize(wPx: number, hPx: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(wPx * dpr);
    this.canvas.height = Math.round(hPx * dpr);
    this.canvas.style.width = `${wPx}px`;
    this.canvas.style.height = `${hPx}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = wPx;
    this.viewH = hPx;
    this.cell = Math.min(wPx / VIEW_W, hPx / VIEW);
    this.ox = (wPx - this.cell * VIEW_W) / 2;
    this.oy = (hPx - this.cell * VIEW) / 2;
  }

  /** World-coordinate top-left of the camera viewport, centered on the (interpolated) head. */
  private camTopLeft(engine: GameEngine): { x: number; y: number } {
    const head = engine.snake[0];
    if (!head) return { x: 0, y: 0 };
    const prev = engine.prevSnake[0] ?? head;
    const prog = engine.stepProgress();
    const hx = prev.x + (head.x - prev.x) * prog;
    const hy = prev.y + (head.y - prev.y) * prog;
    const maxX = Math.max(0, GRID - VIEW_W);
    const maxY = Math.max(0, GRID - VIEW);
    return {
      x: Math.max(0, Math.min(maxX, hx + 0.5 - VIEW_W / 2)),
      y: Math.max(0, Math.min(maxY, hy + 0.5 - VIEW / 2)),
    };
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
      const px = e.pos ? (e.pos.x + 0.5) * this.cell : this.headPx;
      const py = e.pos ? (e.pos.y + 0.5) * this.cell : this.headPy;
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
          if (!reducedMotion && (e.count ?? 0) >= 4) {
            // long chains land like drum hits
            this.shake.mag = Math.max(this.shake.mag, 2 + (e.count ?? 0) * 0.6);
            this.shake.remaining = Math.max(this.shake.remaining, 0.22);
          }
          break;
        case 'evolve':
          this.burst(px, py, this.geneColor(e.gene) ?? e.color ?? COLORS.purple, Math.round((e.count ?? 36) * scale), 220);
          this.ring(px, py, this.cell * 0.5, this.cell * 6, this.geneColor(e.gene) ?? e.color ?? COLORS.purple, 0.7, 5);
          this.ring(px, py, this.cell * 0.3, this.cell * 9.5, this.geneColor(e.gene) ?? e.color ?? COLORS.purple, 0.9, 3);
          if (e.text) this.popup(px, py - this.cell * 0.6, e.text, this.geneColor(e.gene) ?? COLORS.gold, 24);
          if (!reducedMotion) {
            this.shake.mag = 12;
            this.shake.remaining = 0.5;
            this.flash.alpha = 0.35;
            this.flash.color = this.geneColor(e.gene) ?? COLORS.gold;
            this.flash.decay = 1.8;
            this.bgPulse = 1;
          }
          break;
        case 'shieldBreak':
          this.burst(px, py, COLORS.blue, Math.round(24 * scale), 160);
          this.ring(px, py, this.cell * 0.5, this.cell * 2.4, COLORS.blue, 0.45, 4);
          if (!reducedMotion) {
            this.shake.mag = Math.max(this.shake.mag, 5);
            this.shake.remaining = Math.max(this.shake.remaining, 0.25);
            this.flash.alpha = Math.max(this.flash.alpha, 0.2);
            this.flash.color = COLORS.blue;
            this.flash.decay = 2.2;
          }
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
          this.ring(px, py, this.cell * 0.4, this.cell * 4, COLORS.gold, 0.55, 3);
          if (e.text) this.popup(px, py - this.cell * 0.5, e.text, COLORS.gold, 20);
          if (!reducedMotion) {
            this.flash.alpha = Math.max(this.flash.alpha, 0.12);
            this.flash.color = COLORS.gold;
            this.flash.decay = 2.0;
          }
          break;
        case 'crown':
          if (e.pos) {
            this.ring(px, py, this.cell * 0.3, this.cell * 3, COLORS.gold, 0.5, 3);
            this.burst(px, py, COLORS.gold, Math.round(14 * scale), 110);
          }
          break;
        case 'buff':
          this.burst(px, py, e.color ?? COLORS.green, Math.round((e.count ?? 14) * scale), 150);
          this.ring(px, py, this.cell * 0.4, this.cell * 2.2, e.color ?? COLORS.green, 0.45, 3);
          if (e.text) this.popup(px, py - this.cell * 0.4, e.text, e.color ?? COLORS.green, 16);
          break;
        case 'debuff':
          this.burst(px, py, e.color ?? '#C43A52', Math.round((e.count ?? 14) * scale), 150);
          this.ring(px, py, this.cell * 0.4, this.cell * 2.0, e.color ?? '#C43A52', 0.4, 3);
          if (e.text) this.popup(px, py - this.cell * 0.4, e.text, e.color ?? '#FF6B6B', 16);
          if (!reducedMotion) {
            this.flash.alpha = Math.max(this.flash.alpha, 0.12);
            this.flash.color = e.color ?? '#C43A52';
            this.flash.decay = 2.0;
          }
          break;
        case 'reaction':
          this.burst(px, py, e.color ?? COLORS.purple, Math.round((e.count ?? 40) * scale), 240);
          this.ring(px, py, this.cell * 0.5, this.cell * 6, e.color ?? COLORS.purple, 0.7, 5);
          this.ring(px, py, this.cell * 0.3, this.cell * 8.5, e.color ?? COLORS.purple, 0.8, 3);
          if (e.text) this.popup(px, py - this.cell * 0.6, e.text, e.color ?? COLORS.gold, 24);
          if (!reducedMotion) {
            this.shake.mag = 9;
            this.shake.remaining = 0.4;
            this.flash.alpha = 0.35;
            this.flash.color = e.color ?? COLORS.gold;
            this.flash.decay = 1.6;
          }
          break;
        case 'secondLife':
          this.burst(px, py, COLORS.gold, Math.round(36 * scale), 200);
          this.ring(px, py, this.cell * 0.5, this.cell * 4, COLORS.gold, 0.6, 5);
          this.ring(px, py, this.cell * 0.3, this.cell * 7, COLORS.gold, 0.8, 3);
          if (!reducedMotion) {
            this.shake.mag = 8;
            this.shake.remaining = 0.4;
            this.flash.alpha = 0.4;
            this.flash.color = COLORS.gold;
            this.flash.decay = 1.4;
          }
          break;
        case 'death':
          this.deathAnimating = true;
          this.deathFade = 0;
          this.burst(px, py, '#FF5365', Math.round(40 * scale), 280);
          this.ring(px, py, this.cell * 0.5, this.cell * 7, '#FF5365', 0.8, 6);
          if (!reducedMotion) {
            this.shake.mag = 15;
            this.shake.remaining = 0.7;
            this.flash.alpha = 0.45;
            this.flash.color = '#FF5365';
            this.flash.decay = 2.4;
          }
          break;
        case 'eventStart':
          this.popup(px, py - this.cell * 0.6, e.text ?? '事件', COLORS.gold, 22);
          this.ring(px, py, this.cell * 0.4, this.cell * 5, COLORS.gold, 0.6, 3);
          if (!reducedMotion) {
            this.flash.alpha = Math.max(this.flash.alpha, 0.15);
            this.flash.color = COLORS.gold;
            this.flash.decay = 2.0;
          }
          break;
        case 'bossSpawn':
          this.burst(px, py, e.color ?? '#FF5365', Math.round(30 * scale), 220);
          this.ring(px, py, this.cell * 0.6, this.cell * 7, e.color ?? '#FF5365', 0.8, 6);
          this.ring(px, py, this.cell * 0.4, this.cell * 11, e.color ?? '#FF5365', 1.1, 3);
          if (e.text) this.popup(px, py - this.cell * 0.8, e.text, e.color ?? '#FF5365', 24);
          if (!reducedMotion) {
            this.shake.mag = 12;
            this.shake.remaining = 0.6;
            this.flash.alpha = 0.4;
            this.flash.color = e.color ?? '#FF5365';
            this.flash.decay = 1.5;
          }
          break;
        case 'bossShoot':
          this.burst(px, py, e.color ?? '#FF9A3D', Math.round(6 * scale), 120);
          break;
        case 'bossHit':
          this.burst(px, py, e.color ?? '#FF7030', Math.round(6 * scale), 140);
          break;
        case 'bossDeath':
          // layered explosion: gold fireball + orange debris + double shockwaves
          this.burst(px, py, e.color ?? COLORS.gold, Math.round(44 * scale), 260);
          this.burst(px, py, '#FF7A45', Math.round(28 * scale), 180);
          this.ring(px, py, this.cell * 0.6, this.cell * 9, e.color ?? COLORS.gold, 0.9, 7);
          this.ring(px, py, this.cell * 0.8, this.cell * 15, e.color ?? COLORS.gold, 1.3, 3);
          if (e.text) this.popup(px, py - this.cell * 0.8, e.text, e.color ?? COLORS.gold, 26);
          if (!reducedMotion) {
            this.shake.mag = 16;
            this.shake.remaining = 0.8;
            this.flash.alpha = 0.45;
            this.flash.color = e.color ?? COLORS.gold;
            this.flash.decay = 1.3;
            this.bgPulse = 1;
          }
          break;
        case 'playerShoot':
          this.burst(px, py, e.color ?? '#BFE6FF', Math.round(4 * scale), 90);
          if (e.text) this.popup(px, py - this.cell * 0.4, e.text, e.color ?? '#4EF1A3', 15);
          break;
        case 'playerHit':
          this.burst(px, py, e.color ?? '#FF5365', Math.round(18 * scale), 200);
          this.ring(px, py, this.cell * 0.4, this.cell * 3, e.color ?? '#FF5365', 0.5, 4);
          if (e.text) this.popup(px, py - this.cell * 0.5, e.text, e.color ?? '#FF5365', e.big ? 22 : 16);
          if (!reducedMotion) {
            this.shake.mag = 9;
            this.shake.remaining = 0.35;
            this.flash.alpha = Math.max(this.flash.alpha, 0.2);
            this.flash.color = e.color ?? '#FF5365';
            this.flash.decay = 2.0;
          }
          break;
        case 'minionSpawn':
          this.burst(px, py, e.color ?? '#FF9A3D', Math.round(12 * scale), 150);
          this.ring(px, py, this.cell * 0.3, this.cell * 2, e.color ?? '#FF9A3D', 0.4, 3);
          break;
        case 'minionDeath':
          this.burst(px, py, e.color ?? '#FF9A3D', Math.round(14 * scale), 180);
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
    const viewW = this.viewW;
    const viewH = this.viewH;
    const vmin = Math.min(viewW, viewH);
    const ox = this.ox;
    const oy = this.oy;
    const cell = this.cell;
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
      r.r = r.r + (r.maxR - r.r) * Math.min(1, dt * 8);
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

    const cam = this.camTopLeft(engine);
    const head = engine.snake[0];
    this.headPx = head ? (head.x + 0.5) * cell : viewW * 0.5;
    this.headPy = head ? (head.y + 0.5) * cell : viewH * 0.5;

    ctx.save();
    // screen shake
    if (this.shake.remaining > 0 && !opts.reducedMotion) {
      const m = this.shake.mag * (this.shake.remaining / 0.45);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    // ---- screen-space background ----
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-10, -10, viewW + 20, viewH + 20);
    ctx.fillStyle = COLORS.board;
    ctx.fillRect(0, 0, viewW, viewH);
    const bgBoost = this.bgPulse * 0.1;
    if (bgBoost > 0) {
      ctx.fillStyle = COLORS.purple;
      ctx.globalAlpha = bgBoost;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }

    // event / effect tints
    if (engine.activeEvent?.kind === 'goldenTime') {
      ctx.fillStyle = COLORS.gold;
      ctx.globalAlpha = 0.05 + 0.02 * Math.sin(t * 4);
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }
    if (
      engine.hasEffect('slow') ||
      engine.hasEffect('condense') ||
      engine.hasEffect('afterimage') ||
      engine.hasEffect('iceArmor') ||
      engine.hasEffect('superconduct')
    ) {
      ctx.fillStyle = COLORS.blue;
      ctx.globalAlpha = 0.06;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }
    if (engine.hasEffect('haste') || engine.hasEffect('overload')) {
      ctx.fillStyle = '#FF7A45';
      ctx.globalAlpha = 0.05;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }

    // ambient particles (screen space)
    if (!opts.reducedMotion) {
      for (const a of this.ambient) {
        ctx.fillStyle = COLORS.blue;
        ctx.globalAlpha = a.a;
        ctx.beginPath();
        ctx.arc(a.x * viewW, a.y * viewH, a.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---- world space (camera transform) ----
    ctx.save();
    ctx.translate(ox - cam.x * cell, oy - cam.y * cell);

    // grid lines across the visible range only
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    const gx0 = Math.floor(cam.x);
    const gx1 = Math.ceil(cam.x + VIEW_W);
    const gy0 = Math.floor(cam.y);
    const gy1 = Math.ceil(cam.y + VIEW);
    for (let i = gx0; i <= gx1; i++) {
      ctx.moveTo(i * cell, gy0 * cell);
      ctx.lineTo(i * cell, gy1 * cell);
    }
    for (let j = gy0; j <= gy1; j++) {
      ctx.moveTo(gx0 * cell, j * cell);
      ctx.lineTo(gx1 * cell, j * cell);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ---- obstacles: lethal rubble slabs (also bullet cover) ----
    for (const o of engine.obstacles) {
      if (o.x > cam.x + VIEW_W + 1 || o.x + o.w < cam.x - 1 || o.y > cam.y + VIEW + 1 || o.y + o.h < cam.y - 1) continue;
      const X = o.x * cell;
      const Y = o.y * cell;
      const W = o.w * cell;
      const H = o.h * cell;
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(X, Y, W, H);
      // cell seams keep the slab readable as grid-aligned blocks
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 1; i < o.w; i++) {
        ctx.moveTo(X + i * cell, Y);
        ctx.lineTo(X + i * cell, Y + H);
      }
      for (let j = 1; j < o.h; j++) {
        ctx.moveTo(X, Y + j * cell);
        ctx.lineTo(X + W, Y + j * cell);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // hairline edge + inset corner ticks (instrument styling)
      ctx.strokeStyle = COLORS.obstacleEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X + 1.5, Y + 1.5, W - 3, H - 3);
      const tick = Math.min(cell * 0.4, 10);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X + 4, Y + 4 + tick);
      ctx.lineTo(X + 4, Y + 4);
      ctx.lineTo(X + 4 + tick, Y + 4);
      ctx.moveTo(X + W - 4 - tick, Y + H - 4);
      ctx.lineTo(X + W - 4, Y + H - 4);
      ctx.lineTo(X + W - 4, Y + H - 4 - tick);
      ctx.stroke();
    }

    // ---- beans (culled to the viewport) ----
    for (const bean of engine.beans) {
      if (
        bean.pos.x < cam.x - 2 ||
        bean.pos.x > cam.x + VIEW_W + 2 ||
        bean.pos.y < cam.y - 2 ||
        bean.pos.y > cam.y + VIEW + 2
      ) {
        continue;
      }
      this.drawBean(bean.kind, (bean.pos.x + 0.5) * cell, (bean.pos.y + 0.5) * cell, t, opts.reducedMotion);
    }

    // ---- snake ----
    this.auraAccum += dt;
    const emitAura = this.auraAccum >= AURA_EMIT_INTERVAL && !opts.reducedMotion && engine.phase === 'playing';
    if (this.auraAccum >= AURA_EMIT_INTERVAL) this.auraAccum = 0;
    this.drawSnake(engine, t, opts, emitAura);

    // ---- combat entities (boss / bullets / minions / player shots) ----
    this.drawCombat(engine, cam, t, opts.reducedMotion);

    // ---- rings ----
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

    // ---- particles ----
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

    // ---- popups (world space) ----
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

    // ---- world boundary (visible near map edges) ----
    ctx.strokeStyle = 'rgba(120,160,220,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, GRID * cell, GRID * cell);

    ctx.restore(); // pop camera

    // ---- screen-space overlays ----
    // fog vignette: restricted-vision debuff darkens the periphery
    if (engine.hasEffect('fog')) {
      const hx = this.headPx - cam.x * cell + ox;
      const hy = this.headPy - cam.y * cell + oy;
      const g = ctx.createRadialGradient(hx, hy, vmin * 0.15, hx, hy, vmin * 0.6);
      g.addColorStop(0, 'rgba(6,10,20,0)');
      g.addColorStop(0.55, 'rgba(6,10,20,0.5)');
      g.addColorStop(1, 'rgba(6,10,20,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // border glow frame
    const grad = ctx.createLinearGradient(0, 0, viewW, viewH);
    grad.addColorStop(0, 'rgba(67,191,255,0.35)');
    grad.addColorStop(0.5, 'rgba(177,118,255,0.25)');
    grad.addColorStop(1, 'rgba(78,241,163,0.35)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, viewW - 2, viewH - 2);

    // ---- boss off-screen direction indicator (screen space, ignores fog) ----
    this.drawBossArrow(engine, cam, dt, t, opts.reducedMotion);

    // death fade
    if (this.deathFade > 0) {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = this.deathFade;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }

    // flash
    if (this.flash.alpha > 0 && !opts.reducedMotion) {
      ctx.fillStyle = this.flash.color;
      ctx.globalAlpha = this.flash.alpha;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** Draw boss / bullets / minions / player shots in world space (inside the camera transform). */
  private drawCombat(engine: GameEngine, cam: { x: number; y: number }, t: number, reducedMotion: boolean) {
    const ctx = this.ctx;
    const cell = this.cell;
    const vis = (x: number, y: number, m = 2) =>
      x >= cam.x - m && x <= cam.x + VIEW_W + m && y >= cam.y - m && y <= cam.y + VIEW + m;

    // ---- player shots ----
    ctx.globalCompositeOperation = 'lighter';
    for (const s of engine.playerShots) {
      if (!vis(s.pos.x, s.pos.y)) continue;
      const px = (s.pos.x + 0.5) * cell;
      const py = (s.pos.y + 0.5) * cell;
      // 'rainbow' shots (prism barrage) cycle hue over time, phase-shifted per bullet
      const col = s.color === 'rainbow' ? `hsl(${(t * 320 + s.id * 60) % 360}, 95%, 65%)` : s.color;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col;
      if (!reducedMotion) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, s.radius * cell * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // ---- active attack visuals (all forms fire bolts now; draw the muzzle heading / prism rails) ----
    if (engine.attackActive && engine.phase === 'playing') {
      const head = engine.snake[0];
      if (head) {
        const hx = (head.x + 0.5) * cell;
        const hy = (head.y + 0.5) * cell;
        const { form } = engine.attackFormInfo();
        const aim = Math.atan2(engine.aimY, engine.aimX);
        if (form === 'prism') {
          // raiden-style twin columns: two glowing rainbow rails along the heading (bolts drawn above)
          const railHue = reducedMotion ? 280 : (t * 200) % 360;
          const railCol = `hsl(${railHue}, 95%, 65%)`;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = railCol;
          ctx.shadowColor = railCol;
          ctx.shadowBlur = reducedMotion ? 0 : 8;
          ctx.lineWidth = cell * 0.08;
          ctx.setLineDash([cell * 0.3, cell * 0.22]);
          for (const side of [-1, 1] as const) {
            const ox = -Math.sin(aim) * side * PRISM_COLUMN_OFFSET * cell;
            const oy = Math.cos(aim) * side * PRISM_COLUMN_OFFSET * cell;
            ctx.beginPath();
            ctx.moveTo(hx + ox, hy + oy);
            ctx.lineTo(hx + ox + Math.cos(aim) * cell * 3.2, hy + oy + Math.sin(aim) * cell * 3.2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        } else {
          // every non-prism form fires bolts; a form-colored dashed aim line shows the muzzle heading
          const aimColor =
            form === 'red' ? '#FF5365' : form === 'blue' ? '#43BFFF' : form === 'green' ? '#4EF1A3' : '#BFE6FF';
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = aimColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([cell * 0.25, cell * 0.25]);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + Math.cos(aim) * cell * 2.5, hy + Math.sin(aim) * cell * 2.5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ---- boss bullets ----
    for (const b of engine.bullets) {
      if (!vis(b.pos.x, b.pos.y)) continue;
      const px = (b.pos.x + 0.5) * cell;
      const py = (b.pos.y + 0.5) * cell;
      if (b.muzzle > 0) {
        // frozen muzzle-flash telegraph: a ring that closes in as the shot charges
        const k = 1 - b.muzzle / BULLET_MUZZLE;
        ctx.globalAlpha = 0.35 + 0.45 * k;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, b.radius * cell * (1.6 - 0.9 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = reducedMotion ? 0 : 10;
      ctx.beginPath();
      ctx.arc(px, py, b.radius * cell, 0, Math.PI * 2);
      ctx.fill();
      if (b.special) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, b.radius * cell * 1.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
    }

    // ---- minions ----
    for (const m of engine.minions) {
      if (!vis(m.pos.x, m.pos.y)) continue;
      const px = (m.pos.x + 0.5) * cell;
      const py = (m.pos.y + 0.5) * cell;
      const r = cell * 0.32;
      ctx.fillStyle = '#FF9A3D';
      ctx.shadowColor = '#FF9A3D';
      ctx.shadowBlur = reducedMotion ? 0 : 8;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // hp arc
      const frac = Math.max(0, m.hp / m.maxHp);
      ctx.strokeStyle = '#EDF4FF';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // eye
      ctx.fillStyle = '#1B2940';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // status tints: frozen (blue wash) / poisoned (green ring)
      if (m.slowTimer > 0) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#7FE9FF';
        ctx.beginPath();
        ctx.arc(px, py, r * 1.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (m.poisonStacks > 0) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#4EF1A3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ---- boss ----
    const boss = engine.boss;
    if (boss && vis(boss.pos.x, boss.pos.y, 4)) {
      const px = (boss.pos.x + 0.5) * cell;
      const py = (boss.pos.y + 0.5) * cell;
      const phaseColor = BOSS_ARROW_COLORS[boss.phase] ?? '#FF5365';
      const R = cell * 1.1;
      if (boss.telegraph > 0) {
        // warning telegraph: pulsing outline that grows until the boss activates
        const k = 1 - boss.telegraph / BOSS_TELEGRAPH;
        ctx.globalAlpha = reducedMotion ? 0.5 : 0.35 + 0.35 * Math.sin(t * 12);
        ctx.strokeStyle = phaseColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, R * (0.4 + k * 0.8), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // rotating 6-spike star body
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(reducedMotion ? 0 : t * 0.3);
        ctx.fillStyle = '#1B2940';
        ctx.strokeStyle = phaseColor;
        ctx.shadowColor = phaseColor;
        ctx.shadowBlur = reducedMotion ? 0 : 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const rad = i % 2 ? R * 0.7 : R;
          const a = (i / 12) * Math.PI * 2;
          const sx = Math.cos(a) * rad;
          const sy = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // pulsing core
        ctx.fillStyle = phaseColor;
        ctx.globalAlpha = reducedMotion ? 0.9 : 0.7 + 0.3 * Math.sin(t * 5);
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.shadowBlur = 0;
        // freeze-slow: icy blue wash + frost ring while the boss is chilled
        if (boss.slowTimer > 0) {
          ctx.globalAlpha = reducedMotion ? 0.25 : 0.22 + 0.1 * Math.sin(t * 6);
          ctx.fillStyle = '#7FE9FF';
          ctx.beginPath();
          ctx.arc(px, py, R * 1.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = '#7FE9FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, R * 1.15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // poison: rotating dashed green ring, one per visible stack would be noise — a single ring suffices
        if (engine.bossPoisonStacks > 0) {
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = '#4EF1A3';
          ctx.lineWidth = 2;
          ctx.setLineDash([cell * 0.18, cell * 0.14]);
          ctx.beginPath();
          ctx.arc(px, py, R * 1.3, reducedMotion ? 0 : t * 1.2, (reducedMotion ? 0 : t * 1.2) + Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        // hp bar above the boss — proportional padding so the fill stays visible at any cell size
        const frac = Math.max(0, boss.hp / boss.maxHp);
        const w = cell * 2.4;
        const h = Math.max(4, cell * 0.3);
        const pad = Math.max(1, h * 0.2);
        const bx = px - w / 2;
        const by = py - R - h * 2;
        ctx.fillStyle = 'rgba(6,10,20,0.9)';
        ctx.fillRect(bx, by, w, h);
        ctx.fillStyle = phaseColor;
        ctx.fillRect(bx + pad, by + pad, Math.max(0, (w - pad * 2) * frac), h - pad * 2);
      }
    }
  }

  /** Screen-space arrow at the viewport edge pointing toward an off-screen active boss. */
  private drawBossArrow(
    engine: GameEngine,
    cam: { x: number; y: number },
    dt: number,
    t: number,
    reducedMotion: boolean,
  ) {
    const ctx = this.ctx;
    const boss = engine.boss;
    const head = engine.snake[0];
    const inView =
      !!boss &&
      boss.pos.x >= cam.x - 0.5 &&
      boss.pos.x <= cam.x + VIEW_W + 0.5 &&
      boss.pos.y >= cam.y - 0.5 &&
      boss.pos.y <= cam.y + VIEW + 0.5;
    const target = boss && boss.telegraph <= 0 && !inView ? 1 : 0;
    // ease toward the target over BOSS_ARROW_FADE seconds
    const step = dt / BOSS_ARROW_FADE;
    this.arrowAlpha = target
      ? Math.min(1, this.arrowAlpha + step)
      : Math.max(0, this.arrowAlpha - step);
    if (!boss || !head || this.arrowAlpha <= 0.01) return;

    const cx = this.viewW / 2;
    const cy = this.viewH / 2;
    const vp = Math.min(this.viewW, this.viewH);
    const dx = boss.pos.x - head.x;
    const dy = boss.pos.y - head.y;
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // anchor on the viewport edge along the ray from the center
    const hw = cx - vp * 0.08;
    const hh = cy - vp * 0.08;
    const scale = Math.min(
      Math.abs(cos) < 1e-6 ? Infinity : hw / Math.abs(cos),
      Math.abs(sin) < 1e-6 ? Infinity : hh / Math.abs(sin),
    );
    const ax = cx + cos * scale;
    const ay = cy + sin * scale;
    const color = BOSS_ARROW_COLORS[boss.phase] ?? '#FF5365';
    const alpha = this.arrowAlpha * (reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 6));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    const s = vp * 0.035;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = reducedMotion ? 0 : 12;
    ctx.beginPath();
    ctx.moveTo(s * 1.6, 0);
    ctx.lineTo(-s, s);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s, -s);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // distance label along the ray, just inside the arrow
    const dist = Math.round(Math.hypot(dx, dy));
    ctx.rotate(-angle);
    ctx.font = `bold ${vp * 0.032}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#EDF4FF';
    ctx.fillText(`${dist}格`, -cos * vp * 0.07, -sin * vp * 0.07);
    ctx.restore();
    ctx.globalAlpha = 1;
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
    else if (kind in BEAN_COLORS) color = BEAN_COLORS[kind as keyof typeof BEAN_COLORS];

    const isDebuff = kind === 'haste' || kind === 'fog' || kind === 'corrupt' || kind === 'weak';

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = reducedMotion ? 4 : 12;

    // spiky danger halo so harmful beans read at a glance
    if (isDebuff && !reducedMotion) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,64,86,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const spikes = 10;
      for (let i = 0; i <= spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + t * 1.6;
        const rr = i % 2 === 0 ? r * 1.75 : r * 1.35;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

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
    } else if (kind === 'haste') {
      // double chevron pointing right (speed)
      ctx.fillStyle = color;
      for (let i = 0; i < 2; i++) {
        const ox = -r * 0.4 + i * r * 0.65;
        ctx.beginPath();
        ctx.moveTo(x + ox - r * 0.3, y - r * 0.75);
        ctx.lineTo(x + ox + r * 0.45, y);
        ctx.lineTo(x + ox - r * 0.3, y + r * 0.75);
        ctx.lineTo(x + ox - r * 0.02, y);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'fog') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      const puffs: [number, number, number][] = [
        [-r * 0.45, r * 0.12, r * 0.55],
        [r * 0.4, r * 0.16, r * 0.5],
        [0, -r * 0.28, r * 0.62],
      ];
      for (const [dx, dy, rr] of puffs) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'corrupt') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 1.15);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#20060c';
      ctx.lineWidth = r * 0.34;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.42, y);
      ctx.lineTo(x + r * 0.42, y);
      ctx.stroke();
    } else if (kind === 'weak') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.35);
      ctx.lineTo(x - r * 0.1, y + r * 0.1);
      ctx.lineTo(x + r * 0.2, y - r * 0.2);
      ctx.lineTo(x + r * 0.6, y + r * 0.35);
      ctx.stroke();
    } else if (kind === 'shield') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 0.92, y - r * 0.5);
      ctx.lineTo(x + r * 0.92, y + r * 0.3);
      ctx.quadraticCurveTo(x + r * 0.92, y + r * 1.0, x, y + r * 1.3);
      ctx.quadraticCurveTo(x - r * 0.92, y + r * 1.0, x - r * 0.92, y + r * 0.3);
      ctx.lineTo(x - r * 0.92, y - r * 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'purify') {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        const rr = i % 2 === 0 ? r * 1.3 : r * 0.45;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'fire') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.35);
      ctx.quadraticCurveTo(x + r, y - r * 0.15, x + r * 0.55, y + r * 0.7);
      ctx.quadraticCurveTo(x, y + r * 1.25, x - r * 0.55, y + r * 0.7);
      ctx.quadraticCurveTo(x - r, y - r * 0.15, x, y - r * 1.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,244,196,0.9)';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.45);
      ctx.quadraticCurveTo(x + r * 0.4, y + r * 0.25, x, y + r * 0.8);
      ctx.quadraticCurveTo(x - r * 0.4, y + r * 0.25, x, y - r * 0.45);
      ctx.fill();
    } else if (kind === 'ice') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + t * 0.6;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * r * 1.25, y - Math.sin(a) * r * 1.25);
        ctx.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'lightning') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.25, y - r * 1.35);
      ctx.lineTo(x - r * 0.6, y + r * 0.12);
      ctx.lineTo(x - r * 0.05, y + r * 0.12);
      ctx.lineTo(x - r * 0.3, y + r * 1.35);
      ctx.lineTo(x + r * 0.66, y - r * 0.28);
      ctx.lineTo(x + r * 0.1, y - r * 0.28);
      ctx.closePath();
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

  private drawSnake(engine: GameEngine, t: number, opts: RenderOptions, emit: boolean) {
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

    // persistent additive body tint per active effect — stacked buffs blend naturally
    if (engine.effects.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = c * 0.85;
      for (const e of engine.effects) {
        const def = AURA_DEF[e.kind];
        if (!def?.tint) continue;
        ctx.strokeStyle = EFFECT_COLORS[e.kind];
        ctx.globalAlpha = opts.reducedMotion ? def.tint : def.tint * (0.75 + 0.25 * Math.sin(t * 3));
        ctx.beginPath();
        for (let i = pts.length - 1; i >= 0; i--) {
          if (i === pts.length - 1) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

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
        // eyes oriented along the continuous heading
        const ex = Math.cos(engine.heading);
        const ey = Math.sin(engine.heading);
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

    // ---- permanent morph features (evolution direction x stage) ----
    this.drawMorph(engine, pts, t, opts, emit);

    // ---- persistent stacked auras around the head (one ring per effect) ----
    if (engine.effects.length > 0) {
      const hx = pts[0].x;
      const hy = pts[0].y;
      const headR = c * 0.5;
      let ringIdx = 0;
      for (const e of engine.effects) {
        const def = AURA_DEF[e.kind];
        if (!def) continue;
        const col = EFFECT_COLORS[e.kind];
        if (def.ring) {
          const rr = headR + 6 + ringIdx * 4.5;
          ctx.save();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.6;
          ctx.shadowColor = col;
          ctx.shadowBlur = opts.reducedMotion ? 0 : 6;
          if (def.ring === 'dash') {
            ctx.setLineDash([4, 6]);
            ctx.lineDashOffset = opts.reducedMotion ? 0 : -t * 24 + ringIdx * 7;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(hx, hy, rr, 0, Math.PI * 2);
            ctx.stroke();
          } else if (def.ring === 'pulse') {
            ctx.globalAlpha = opts.reducedMotion ? 0.55 : 0.4 + 0.3 * Math.sin(t * 5 + ringIdx * 2);
            ctx.beginPath();
            ctx.arc(hx, hy, rr, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.globalAlpha = 0.85;
            const a0 = opts.reducedMotion ? 0 : t * 2 + ringIdx * 2.1;
            ctx.beginPath();
            ctx.arc(hx, hy, rr, a0, a0 + Math.PI * 1.2);
            ctx.stroke();
          }
          ctx.restore();
          ringIdx++;
        }
        if (def.emit && emit) this.emitAura(def.emit, col, hx, hy, engine.dir, headR);
      }
    }
  }

  // ---------- permanent morph appearance (evolution direction × stage) ----------

  private drawMorph(
    engine: GameEngine,
    pts: { x: number; y: number }[],
    t: number,
    opts: RenderOptions,
    emit: boolean,
  ) {
    const morph = engine.morph;
    if (!morph.prism && morph.tiers.red + morph.tiers.blue + morph.tiers.green === 0) return;
    const ctx = this.ctx;
    const c = this.cell;
    const ms = morphSummary(morph);
    const head = pts[0];
    const tail = pts[pts.length - 1];
    const tailPrev = pts[pts.length - 2] ?? tail;
    const ang = engine.heading;
    const tailAng = Math.atan2(tail.y - tailPrev.y, tail.x - tailPrev.x);
    const cam = this.camTopLeft(engine);
    const visible = (p: { x: number; y: number }) =>
      p.x >= (cam.x - 2) * c && p.x <= (cam.x + VIEW_W + 2) * c &&
      p.y >= (cam.y - 2) * c && p.y <= (cam.y + VIEW + 2) * c;

    if (morph.prism) {
      // hue-cycling prismatic body + rotating hexagon crown, overrides race visuals
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        if (!visible(p)) continue;
        const hue = (t * 60 + i * 14) % 360;
        ctx.fillStyle = `hsla(${hue}, 95%, 62%, 0.22)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, c * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(opts.reducedMotion ? 0 : t * 1.4);
      const hue = (t * 90) % 360;
      ctx.strokeStyle = `hsl(${hue}, 95%, 68%)`;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = opts.reducedMotion ? 0 : 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * c * 0.78;
        const py = Math.sin(a) * c * 0.78;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      if (emit) {
        this.emitAura('wisp', `hsl(${(t * 120) % 360}, 95%, 68%)`, tail.x, tail.y, engine.dir, c * 0.3);
      }
      return;
    }

    for (const race of ms.races) {
      const m: MorphDrawCtx = {
        stage: ms.stage,
        head,
        tail,
        ang,
        tailAng,
        pts,
        visible,
        t,
        opts,
        pal: MORPH_DEFS[race].palette,
      };
      if (race === 'red') this.drawRedMorph(m);
      else if (race === 'blue') this.drawBlueMorph(m);
      else this.drawGreenMorph(m);
      if (emit && Math.random() < 0.5) {
        this.emitAura(race === 'red' ? 'ember' : 'wisp', m.pal.glow, tail.x, tail.y, engine.dir, c * 0.3);
      }
    }
  }

  /** 炎狱兽：后掠双角（3 阶冠焰）、体表裂纹光纹、焰状尾。 */
  private drawRedMorph(m: MorphDrawCtx) {
    const ctx = this.ctx;
    const c = this.cell;
    const { head, tail, ang, tailAng, pts, visible, t, opts, pal, stage } = m;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 10;
    ctx.fillStyle = pal.secondary;
    const hl = c * (0.28 + 0.12 * stage);
    const hornCount = stage >= 3 ? 3 : 2;
    for (let k = 0; k < hornCount; k++) {
      const side = k === 2 ? 0 : k === 0 ? -1 : 1; // 3rd horn: crown center
      const scale = k === 2 ? 1.25 : 1;
      const by = side * c * 0.2;
      const flick = opts.reducedMotion ? 0 : Math.sin(t * 9 + k * 2) * c * 0.03;
      ctx.beginPath();
      ctx.moveTo(c * 0.07, by - side * c * 0.06);
      ctx.quadraticCurveTo(-hl * 0.5, by + side * c * 0.1 + flick, -hl * scale, by + side * c * (0.26 + 0.04 * stage) + flick);
      ctx.quadraticCurveTo(-hl * 0.45, by + side * c * 0.02, c * 0.07, by + side * c * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    if (stage >= 3) {
      ctx.fillStyle = pal.glow;
      ctx.globalAlpha = opts.reducedMotion ? 0.7 : 0.55 + 0.25 * Math.sin(t * 11);
      ctx.beginPath();
      ctx.moveTo(-hl * 1.1, 0);
      ctx.quadraticCurveTo(-hl * 0.6, -c * 0.12, -hl * 0.2, 0);
      ctx.quadraticCurveTo(-hl * 0.6, c * 0.12, -hl * 1.1, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (stage >= 2) {
      // glowing crack zigzags across the body
      ctx.save();
      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = 1;
      for (let i = 1; i < pts.length - 1; i += 3) {
        const p = pts[i];
        if (!visible(p)) continue;
        const seg = Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x) + Math.PI / 2;
        ctx.globalAlpha = opts.reducedMotion ? 0.4 : 0.3 + 0.2 * Math.sin(t * 4 + i);
        ctx.beginPath();
        const w = c * 0.28;
        ctx.moveTo(p.x - Math.cos(seg) * w, p.y - Math.sin(seg) * w);
        ctx.lineTo(p.x + Math.cos(seg) * w * 0.3, p.y + Math.sin(seg) * w * 0.3);
        ctx.lineTo(p.x + Math.cos(seg) * w, p.y + Math.sin(seg) * w);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(tailAng + Math.PI); // flame streams backward
    const fl = c * (0.35 + 0.1 * stage);
    const wob = opts.reducedMotion ? 1 : 1 + 0.15 * Math.sin(t * 8);
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 12;
    ctx.fillStyle = pal.secondary;
    ctx.beginPath();
    ctx.moveTo(fl * wob, 0);
    ctx.quadraticCurveTo(fl * 0.4, -c * 0.22, 0, -c * 0.1);
    ctx.quadraticCurveTo(fl * 0.25, 0, 0, c * 0.1);
    ctx.quadraticCurveTo(fl * 0.4, c * 0.22, fl * wob, 0);
    ctx.fill();
    ctx.fillStyle = pal.primary;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(fl * wob * 0.55, 0);
    ctx.quadraticCurveTo(fl * 0.3, -c * 0.1, 0, -c * 0.05);
    ctx.quadraticCurveTo(fl * 0.15, 0, 0, c * 0.05);
    ctx.quadraticCurveTo(fl * 0.3, c * 0.1, fl * wob * 0.55, 0);
    ctx.fill();
    ctx.restore();
  }

  /** 渊灵：流线吻部、头部幻影环、玻璃高光、流光飘带尾。 */
  private drawBlueMorph(m: MorphDrawCtx) {
    const ctx = this.ctx;
    const c = this.cell;
    const { head, tail, ang, tailAng, pts, visible, t, opts, pal, stage } = m;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 8;
    ctx.fillStyle = pal.primary;
    ctx.globalAlpha = 0.9;
    const sl = c * (0.18 + 0.07 * stage);
    ctx.beginPath();
    ctx.moveTo(c * 0.42 + sl, 0);
    ctx.quadraticCurveTo(c * 0.3, -c * 0.24, c * 0.05, -c * 0.3);
    ctx.lineTo(c * 0.05, c * 0.3);
    ctx.quadraticCurveTo(c * 0.3, c * 0.24, c * 0.42 + sl, 0);
    ctx.fill();
    ctx.restore();

    if (stage >= 2) {
      // dashed phantom ring trailing behind the head
      ctx.save();
      const bx = head.x - Math.cos(ang) * c * 0.65;
      const by = head.y - Math.sin(ang) * c * 0.65;
      ctx.strokeStyle = pal.secondary;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = opts.reducedMotion ? 0 : -t * 18;
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = opts.reducedMotion ? 0 : 6;
      ctx.beginPath();
      ctx.arc(bx, by, c * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // glassy specular arcs along the body
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        if (!visible(p)) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, c * 0.24, Math.PI * 1.05, Math.PI * 1.6);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(tailAng + Math.PI);
    ctx.strokeStyle = pal.secondary;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 6;
    const len = c * (0.4 + 0.12 * stage);
    for (let k = -1; k <= 1; k++) {
      const ph = opts.reducedMotion ? 0 : Math.sin(t * 5 + k * 2) * c * 0.12;
      ctx.globalAlpha = k === 0 ? 0.6 : 0.35;
      ctx.beginPath();
      ctx.moveTo(0, k * c * 0.12);
      ctx.quadraticCurveTo(len * 0.5, k * c * 0.22 + ph, len, k * c * 0.14 + ph);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 共生体：头部触须、流动光纹、孢囊、螺旋卷须尾。 */
  private drawGreenMorph(m: MorphDrawCtx) {
    const ctx = this.ctx;
    const c = this.cell;
    const { head, tail, ang, tailAng, pts, visible, t, opts, pal, stage } = m;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang);
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 6;
    const tl = c * (0.4 + 0.12 * stage);
    for (const side of [-1, 1]) {
      const wave = opts.reducedMotion ? 0 : Math.sin(t * 3 + (side + 1) * 1.7) * c * 0.1;
      ctx.beginPath();
      ctx.moveTo(-c * 0.1, side * c * 0.24);
      ctx.quadraticCurveTo(-tl * 0.6, side * c * 0.42 + wave, -tl, side * c * 0.28 + wave * 1.4);
      ctx.stroke();
    }
    ctx.restore();

    // flowing bioluminescent dots (all stages)
    ctx.save();
    ctx.fillStyle = pal.secondary;
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      if (!visible(p)) continue;
      const phase = opts.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.5 - i * 0.6);
      ctx.globalAlpha = 0.14 + 0.22 * phase;
      ctx.beginPath();
      ctx.arc(p.x, p.y, c * (0.08 + 0.05 * phase), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (stage >= 2) {
      // alternating spore sacs flanking the body
      ctx.save();
      ctx.fillStyle = pal.glow;
      ctx.globalAlpha = 0.45;
      for (let i = 1; i < pts.length - 1; i += 4) {
        const p = pts[i];
        if (!visible(p)) continue;
        const seg = Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x) + Math.PI / 2;
        const side = i % 8 === 1 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(seg) * c * 0.3 * side, p.y + Math.sin(seg) * c * 0.3 * side, c * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(opts.reducedMotion ? tailAng : tailAng + Math.sin(t * 2) * 0.2);
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = opts.reducedMotion ? 0 : 6;
    ctx.beginPath();
    const turns = 1.6 + 0.25 * stage;
    for (let k = 0; k <= 20; k++) {
      const a = (k / 20) * Math.PI * turns;
      const rr = c * 0.06 + (k / 20) * c * 0.22;
      const px = -Math.cos(a) * rr * 0.4 - (k / 20) * c * 0.1;
      const py = Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Throttled per-effect head particle trail; kinds read differently at a glance. */
  private emitAura(kind: EmitKind, color: string, x: number, y: number, dir: string, r: number) {
    const n = kind === 'spark' ? 2 : 1 + (Math.random() < 0.35 ? 1 : 0);
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const ox = Math.cos(a) * r * 0.8;
      const oy = Math.sin(a) * r * 0.8;
      let p: Particle;
      switch (kind) {
        case 'ember': // fire family: rising sparks
          p = {
            x: x + ox, y: y + oy,
            vx: (Math.random() - 0.5) * 26, vy: -(34 + Math.random() * 46),
            life: 0.55 + Math.random() * 0.3, size: 1.4 + Math.random() * 1.3,
            color, kind: 'dot', maxLife: 0,
          };
          break;
        case 'snow': // ice family: drifting flakes
          p = {
            x: x + ox, y: y + oy - 6,
            vx: (Math.random() - 0.5) * 18, vy: 12 + Math.random() * 18,
            life: 0.7 + Math.random() * 0.4, size: 1 + Math.random() * 1.2,
            color, kind: 'dot', maxLife: 0,
          };
          break;
        case 'spark': // lightning family: fast electric shards
          p = {
            x: x + ox, y: y + oy,
            vx: Math.cos(a) * (70 + Math.random() * 90), vy: Math.sin(a) * (70 + Math.random() * 90),
            life: 0.2 + Math.random() * 0.2, size: 1 + Math.random() * 1.1,
            color, kind: 'shard', spin: Math.random() * 6, maxLife: 0,
          };
          break;
        case 'smoke': // debuffs: sluggish haze
          p = {
            x: x + ox, y: y + oy,
            vx: (Math.random() - 0.5) * 12, vy: -(10 + Math.random() * 16),
            life: 0.8 + Math.random() * 0.5, size: 2 + Math.random() * 1.8,
            color, kind: 'dot', maxLife: 0,
          };
          break;
        case 'wisp': // ghost / alien: floating motes
          p = {
            x: x + ox, y: y + oy,
            vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
            life: 0.5 + Math.random() * 0.4, size: 1.3 + Math.random() * 1.4,
            color, kind: 'dot', maxLife: 0,
          };
          break;
        default: // streak: speed lines trailing behind the head
          p = {
            x: x - dx * r, y: y - dy * r,
            vx: -dx * (90 + Math.random() * 70) + (Math.random() - 0.5) * 20,
            vy: -dy * (90 + Math.random() * 70) + (Math.random() - 0.5) * 20,
            life: 0.22 + Math.random() * 0.15, size: 1.2 + Math.random() * 1,
            color, kind: 'shard', spin: Math.random() * 6, maxLife: 0,
          };
          break;
      }
      p.maxLife = p.life;
      this.particles.push(p);
    }
  }
}
