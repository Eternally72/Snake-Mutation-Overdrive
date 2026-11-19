// Procedural audio: all SFX and the 8-bit BGM are synthesized via Web Audio API.
// Graph: (sfxBus | musicBus) -> master -> compressor -> destination

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

let muted = false;
let musicVolume = 0.5;
let sfxVolume = 0.8;

const MASTER_LEVEL = 0.6;
const MUSIC_BUS_SCALE = 0.55;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 14;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume * MUSIC_BUS_SCALE;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, ctx.currentTime, 0.02);
}

export function setMusicVolume(v: number) {
  musicVolume = Math.min(1, Math.max(0, v));
  if (musicBus && ctx && !musicPaused) {
    musicBus.gain.setTargetAtTime(musicVolume * MUSIC_BUS_SCALE, ctx.currentTime, 0.02);
  }
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.min(1, Math.max(0, v));
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.02);
}

// ---------- synth cores ----------

function toneAt(
  bus: GainNode,
  freq: number,
  t0: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  slideTo?: number,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function getNoiseBuffer(): AudioBuffer | null {
  if (!ctx) return null;
  if (!noiseBuf) {
    const len = ctx.sampleRate; // 1 second, reused by every noise voice
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseAt(
  bus: GainNode,
  t0: number,
  duration: number,
  volume: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  filterTo?: number,
) {
  if (!ctx) return;
  const buf = getNoiseBuffer();
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t0);
  if (filterTo) filter.frequency.exponentialRampToValueAtTime(filterTo, t0 + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + duration + 0.02);
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.3,
  slideTo?: number,
  delay = 0,
) {
  if (!ctx || !sfxBus || muted) return;
  toneAt(sfxBus, freq, ctx.currentTime + delay, duration, type, volume, slideTo);
}

function noise(duration: number, volume = 0.2, delay = 0) {
  if (!ctx || !sfxBus || muted) return;
  noiseAt(sfxBus, ctx.currentTime + delay, duration, volume, 'lowpass', 900);
}

// ---------- SFX ----------

const EAT_BASE = 523.25; // C5; chain pitch climbs chromatically from here

export const sfx = {
  eat(chain: number) {
    const f = EAT_BASE * Math.pow(2, Math.min(chain, 11) / 12);
    tone(f, 0.08, 'square', 0.2);
    if (chain >= 2) tone(f * 1.5, 0.06, 'sine', 0.1, undefined, 0.02);
    if (chain >= 4) tone(f * 2, 0.05, 'triangle', 0.08, undefined, 0.03);
  },
  // 3-chain mutation: bright rising triad + shimmer
  mutate() {
    tone(523.25, 0.08, 'square', 0.2);
    tone(659.25, 0.08, 'square', 0.2, undefined, 0.07);
    tone(783.99, 0.12, 'square', 0.22, undefined, 0.14);
    tone(1046.5, 0.25, 'triangle', 0.12, undefined, 0.18);
  },
  // generic big moment (resonance / victory)
  evolve() {
    tone(330, 0.35, 'sawtooth', 0.25, 880);
    tone(660, 0.4, 'square', 0.18, 1320, 0.05);
    noise(0.3, 0.12);
  },
  // 5-chain evolution: full audio climax (~1.3s)
  evolve5() {
    if (!ctx || !sfxBus || muted) return;
    const bus = sfxBus;
    const t = ctx.currentTime;
    toneAt(bus, 220, t, 0.5, 'sine', 0.3, 55); // sub drop
    noiseAt(bus, t, 0.55, 0.14, 'lowpass', 400, 6000); // rising sweep
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0, 2093.0];
    arp.forEach((f, i) => toneAt(bus, f, t + i * 0.075, 0.14, 'square', 0.18));
    const stab = t + 0.55;
    for (const f of [523.25, 659.25, 783.99, 1046.5]) {
      toneAt(bus, f, stab, 0.45, 'sawtooth', 0.09);
      toneAt(bus, f, stab, 0.45, 'square', 0.07);
    }
    toneAt(bus, 2093.0, stab + 0.35, 0.1, 'sine', 0.12); // sparkle tail
    toneAt(bus, 2637.0, stab + 0.45, 0.1, 'sine', 0.12);
    toneAt(bus, 3136.0, stab + 0.55, 0.18, 'sine', 0.12);
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
  buff() {
    tone(600, 0.16, 'sine', 0.28, 920);
    tone(920, 0.14, 'triangle', 0.18, 1240, 0.04);
  },
  debuff() {
    tone(240, 0.24, 'sawtooth', 0.2, 90);
    tone(150, 0.28, 'square', 0.14, 70, 0.03);
  },
  reaction() {
    tone(440, 0.28, 'triangle', 0.3, 880);
    tone(660, 0.32, 'square', 0.2, 1320, 0.05);
    noise(0.28, 0.14);
  },
  // ---------- combat ----------
  bossSpawn() {
    tone(110, 0.6, 'sawtooth', 0.3, 55);
    tone(220, 0.5, 'square', 0.16, 110, 0.05);
    noise(0.5, 0.16);
  },
  bossShoot() {
    tone(340, 0.07, 'square', 0.08, 220);
  },
  bossHit() {
    tone(500, 0.05, 'triangle', 0.1, 380);
  },
  bossDeath() {
    noise(0.6, 0.3);
    tone(180, 0.7, 'sawtooth', 0.3, 40);
    tone(90, 0.9, 'square', 0.22, 30, 0.08);
    tone(523, 0.15, 'square', 0.18, undefined, 0.3);
    tone(784, 0.2, 'square', 0.18, undefined, 0.42);
    tone(1046, 0.3, 'triangle', 0.2, undefined, 0.55);
  },
  playerShoot() {
    tone(880, 0.05, 'triangle', 0.05, 1320);
  },
  playerHit() {
    tone(220, 0.18, 'sawtooth', 0.24, 80);
    noise(0.15, 0.14);
  },
  minionSpawn() {
    tone(300, 0.1, 'square', 0.12, 420);
  },
  minionDeath() {
    noise(0.12, 0.14);
    tone(420, 0.1, 'triangle', 0.14, 180);
  },
};

// ---------- 8-bit loop BGM (original, Am-F-C-G) ----------

const BPM = 142;
const STEP_DUR = 60 / BPM / 4; // 16th note
const LOOP_STEPS = 64; // 4 bars
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const BASS_ROOTS = [45, 41, 48, 43]; // A2 F2 C3 G2
const ARP_NOTES = [
  [69, 72, 76, 72], // Am: A4 C5 E5 C5
  [65, 69, 72, 69], // F:  F4 A4 C5 A4
  [64, 67, 72, 67], // C:  E4 G4 C5 G4
  [67, 71, 74, 71], // G:  G4 B4 D5 B4
];
// lead melody, eighth notes (32 slots), 0 = rest
const LEAD = [
  76, 69, 72, 76, 74, 72, 69, 0,
  65, 69, 72, 69, 65, 69, 72, 0,
  67, 72, 76, 79, 76, 72, 67, 0,
  74, 71, 67, 71, 74, 74, 71, 74,
];

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStarted = false;
let musicPaused = false;
let musicStep = 0;
let nextStepTime = 0;

function musicNote(freq: number, t0: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (!ctx || !musicBus) return;
  toneAt(musicBus, freq, t0, dur, type, vol, slideTo);
}

function scheduleStep(i: number, t: number) {
  const bar = Math.floor(i / 16);
  const s = i % 16;

  if (s % 2 === 0) {
    const k = s / 2;
    const root = BASS_ROOTS[bar];
    const n = k === 3 || k === 7 ? root + 12 : k % 2 === 1 ? root + 7 : root;
    musicNote(midiFreq(n), t, 0.14, 'triangle', 0.3);
  }

  const arp = ARP_NOTES[bar];
  const an = s === 14 ? arp[3] + 12 : arp[s % 4];
  musicNote(midiFreq(an), t, 0.06, 'square', 0.045);

  if (s % 2 === 0) {
    const m = LEAD[bar * 8 + s / 2];
    if (m) musicNote(midiFreq(m), t, STEP_DUR * 1.8, 'square', 0.09);
  }

  if (s === 0 || s === 8) musicNote(140, t, 0.1, 'sine', 0.32, 45); // kick
  if (s % 4 === 2 && ctx && musicBus) noiseAt(musicBus, t, 0.03, 0.05, 'highpass', 6000); // hat
}

function schedulerTick() {
  if (!ctx) return;
  const horizon = ctx.currentTime + LOOKAHEAD;
  while (nextStepTime < horizon) {
    if (!muted && ctx.state === 'running') scheduleStep(musicStep, nextStepTime);
    musicStep = (musicStep + 1) % LOOP_STEPS;
    nextStepTime += STEP_DUR;
  }
}

export function startMusic() {
  initAudio();
  if (!ctx || musicStarted) return;
  musicStarted = true;
  musicPaused = false;
  musicStep = 0;
  nextStepTime = ctx.currentTime + 0.08;
  if (musicTimer === null) musicTimer = setInterval(schedulerTick, TICK_MS);
}

export function stopMusic() {
  musicStarted = false;
  musicPaused = false;
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function setMusicPaused(paused: boolean) {
  if (!ctx || !musicBus || musicPaused === paused) return;
  musicPaused = paused;
  if (paused) {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  } else if (musicStarted) {
    musicBus.gain.setTargetAtTime(musicVolume * MUSIC_BUS_SCALE, ctx.currentTime, 0.05);
    nextStepTime = ctx.currentTime + 0.06;
    if (musicTimer === null) musicTimer = setInterval(schedulerTick, TICK_MS);
  }
}
