let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.01);
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.3,
  slideTo?: number,
  delay = 0,
) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(duration: number, volume = 0.2, delay = 0) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

const CHAIN_BASE = 440;

export const sfx = {
  eat(chain: number) {
    const f = CHAIN_BASE * Math.pow(1.12, Math.min(chain, 8));
    tone(f, 0.09, 'square', 0.22);
    tone(f * 1.5, 0.07, 'sine', 0.15, undefined, 0.02);
  },
  evolve() {
    tone(330, 0.35, 'sawtooth', 0.25, 880);
    tone(660, 0.4, 'square', 0.18, 1320, 0.05);
    noise(0.3, 0.12);
  },
  skill() {
    tone(520, 0.15, 'triangle', 0.3, 780);
  },
  dash() {
    tone(300, 0.18, 'sawtooth', 0.25, 900);
    noise(0.12, 0.1);
  },
  magnet() {
    tone(220, 0.4, 'sine', 0.25, 440);
    tone(330, 0.4, 'triangle', 0.15, 660, 0.05);
  },
  slow() {
    tone(440, 0.5, 'sine', 0.25, 160);
  },
  shed() {
    noise(0.25, 0.2);
    tone(200, 0.2, 'triangle', 0.2, 90);
  },
  shield() {
    tone(700, 0.2, 'sine', 0.3, 350);
    tone(1050, 0.15, 'triangle', 0.2, 525, 0.03);
  },
  upgrade() {
    tone(523, 0.12, 'square', 0.22);
    tone(659, 0.12, 'square', 0.22, undefined, 0.1);
    tone(784, 0.2, 'square', 0.25, undefined, 0.2);
  },
  crown() {
    tone(784, 0.15, 'triangle', 0.3);
    tone(988, 0.15, 'triangle', 0.3, undefined, 0.12);
    tone(1175, 0.25, 'triangle', 0.3, undefined, 0.24);
  },
  deny() {
    tone(160, 0.12, 'square', 0.2, 120);
  },
  death() {
    tone(300, 0.6, 'sawtooth', 0.3, 60);
    noise(0.5, 0.25);
    tone(150, 0.8, 'square', 0.2, 40, 0.1);
  },
  start() {
    tone(392, 0.1, 'square', 0.22);
    tone(523, 0.1, 'square', 0.22, undefined, 0.09);
    tone(659, 0.1, 'square', 0.22, undefined, 0.18);
    tone(784, 0.22, 'square', 0.25, undefined, 0.27);
  },
  event() {
    tone(440, 0.15, 'triangle', 0.25, 660);
    tone(660, 0.2, 'triangle', 0.25, 880, 0.12);
  },
  secondLife() {
    tone(880, 0.3, 'sine', 0.35, 440);
    tone(1320, 0.25, 'triangle', 0.25, 660, 0.05);
  },
};
