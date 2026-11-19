import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- fake Web Audio ----

type ParamEvent = { method: string; value: number; time: number };

class FakeParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  private rec(method: string, value: number, time: number) {
    this.value = value;
    this.events.push({ method, value, time });
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.rec('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.rec('linear', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    return this.rec('exp', v, t);
  }
  setTargetAtTime(v: number, t: number) {
    return this.rec('target', v, t);
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  connect(dest: unknown) {
    return dest;
  }
  disconnect() {}
}

let oscillators: Record<string, unknown>[] = [];
let gains: Record<string, unknown>[] = [];
let bufferSources: Record<string, unknown>[] = [];
let lastCtx: FakeAudioContext | null = null;

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new FakeNode();
  createGain() {
    const n = new FakeNode() as unknown as Record<string, unknown>;
    n.gain = new FakeParam(1);
    gains.push(n);
    return n;
  }
  createOscillator() {
    const n = new FakeNode() as unknown as Record<string, unknown>;
    n.type = 'square';
    n.frequency = new FakeParam(440);
    n.start = () => {};
    n.stop = () => {};
    oscillators.push(n);
    return n;
  }
  createBufferSource() {
    const n = new FakeNode() as unknown as Record<string, unknown>;
    n.buffer = null;
    n.loop = false;
    n.start = () => {};
    n.stop = () => {};
    bufferSources.push(n);
    return n;
  }
  createBuffer(_ch: number, len: number, sr: number) {
    const data = new Float32Array(len);
    return { length: len, sampleRate: sr, getChannelData: () => data };
  }
  createBiquadFilter() {
    const n = new FakeNode() as unknown as Record<string, unknown>;
    n.type = 'lowpass';
    n.frequency = new FakeParam(350);
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode() as unknown as Record<string, unknown>;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0);
    return n;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

const freqOf = (osc: Record<string, unknown>) => (osc.frequency as FakeParam).events[0]?.value ?? 0;

let audio: typeof import('../src/game/audio');

beforeEach(async () => {
  vi.resetModules();
  vi.useRealTimers();
  oscillators = [];
  gains = [];
  bufferSources = [];
  lastCtx = null;
  (globalThis as Record<string, unknown>).AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      lastCtx = this;
    }
  };
  audio = await import('../src/game/audio');
});

describe('合成音效', () => {
  it('吃豆音高随连击等级半音上行', () => {
    audio.initAudio();
    const freqs: number[] = [];
    for (let chain = 0; chain <= 5; chain++) {
      const before = oscillators.length;
      audio.sfx.eat(chain);
      expect(oscillators.length).toBeGreaterThan(before);
      freqs.push(freqOf(oscillators[before]));
    }
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
    }
    // chromatic ratio between adjacent chain levels
    expect(freqs[1] / freqs[0]).toBeCloseTo(Math.pow(2, 1 / 12), 6);
  });

  it('五连进化高潮比三连变异声部更多且含噪声扫频', () => {
    audio.initAudio();
    let before = oscillators.length;
    audio.sfx.mutate();
    const mutateVoices = oscillators.length - before;

    before = oscillators.length;
    const noiseBefore = bufferSources.length;
    audio.sfx.evolve5();
    const evolveVoices = oscillators.length - before;
    expect(mutateVoices).toBeGreaterThanOrEqual(4);
    expect(evolveVoices).toBeGreaterThan(mutateVoices * 2);
    expect(bufferSources.length).toBeGreaterThan(noiseBefore);
  });

  it('静音时不产生振荡器且主总线归零', () => {
    audio.initAudio();
    const master = gains[0];
    audio.setMuted(true);
    const last = (master.gain as FakeParam).events.slice(-1)[0];
    expect(last?.method).toBe('target');
    expect(last?.value).toBe(0);
    const before = oscillators.length;
    audio.sfx.eat(2);
    audio.sfx.evolve5();
    expect(oscillators.length).toBe(before);
  });

  it('音量总线独立可调且被钳制在 0..1', () => {
    audio.initAudio();
    // gain node order: master, sfxBus, musicBus
    const sfxBus = gains[1];
    const musicBus = gains[2];
    audio.setSfxVolume(0.4);
    expect((sfxBus.gain as FakeParam).events.slice(-1)[0]?.value).toBeCloseTo(0.4, 6);
    audio.setMusicVolume(2); // clamped to 1
    expect((musicBus.gain as FakeParam).events.slice(-1)[0]?.value).toBeCloseTo(0.55, 6);
  });
});

describe('8-bit 循环 BGM', () => {
  it('启动后按前瞻调度持续产生音符并循环', () => {
    vi.useFakeTimers();
    audio.initAudio();
    audio.startMusic();
    vi.advanceTimersByTime(30); // first scheduler tick
    expect(oscillators.length).toBeGreaterThan(0);

    const before = oscillators.length;
    // simulate ~7s of audio time (one full 64-step loop) across many ticks
    for (let i = 0; i < 28; i++) {
      lastCtx!.currentTime += 0.25;
      vi.advanceTimersByTime(250);
    }
    const notesPerLoop = oscillators.length - before;
    // 4 bars * (8 bass + 16 arp + ~7 lead + 2 kick) ≈ 130+ voices per loop
    expect(notesPerLoop).toBeGreaterThan(100);

    audio.stopMusic();
    const afterStop = oscillators.length;
    lastCtx!.currentTime += 1;
    vi.advanceTimersByTime(1000);
    expect(oscillators.length).toBe(afterStop);
  });

  it('暂停时淡出并停止调度，恢复后继续', () => {
    vi.useFakeTimers();
    audio.initAudio();
    audio.startMusic();
    audio.setMusicPaused(true);
    const musicBus = gains[2];
    expect((musicBus.gain as FakeParam).events.slice(-1)[0]?.value).toBe(0);

    const paused = oscillators.length;
    lastCtx!.currentTime += 1;
    vi.advanceTimersByTime(1000);
    expect(oscillators.length).toBe(paused);

    audio.setMusicPaused(false);
    expect((musicBus.gain as FakeParam).events.slice(-1)[0]?.value).toBeGreaterThan(0);
    lastCtx!.currentTime += 0.3;
    vi.advanceTimersByTime(300);
    expect(oscillators.length).toBeGreaterThan(paused);
    audio.stopMusic();
  });

  it('静音时调度器空转不产生音符', () => {
    vi.useFakeTimers();
    audio.initAudio();
    audio.setMuted(true);
    audio.startMusic();
    const before = oscillators.length;
    for (let i = 0; i < 8; i++) {
      lastCtx!.currentTime += 0.25;
      vi.advanceTimersByTime(250);
    }
    expect(oscillators.length).toBe(before);
    audio.stopMusic();
  });
});
