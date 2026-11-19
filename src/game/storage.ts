const KEY_HIGH = 'smo_highscore';
const KEY_SETTINGS = 'smo_settings';

export interface Settings {
  muted: boolean;
  reducedMotion: boolean;
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULT_SETTINGS: Settings = {
  muted: false,
  reducedMotion: false,
  musicVolume: 0.5,
  sfxVolume: 0.8,
};

const clamp01 = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(1, Math.max(0, n));
};

export function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(KEY_HIGH)) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): number {
  const prev = loadHighScore();
  const best = Math.max(prev, Math.round(score));
  try {
    localStorage.setItem(KEY_HIGH, String(best));
  } catch {
    /* storage unavailable */
  }
  return best;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        muted: !!p.muted,
        reducedMotion: !!p.reducedMotion,
        musicVolume: clamp01(p.musicVolume, DEFAULT_SETTINGS.musicVolume),
        sfxVolume: clamp01(p.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
