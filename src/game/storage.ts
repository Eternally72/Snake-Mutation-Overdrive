const KEY_HIGH = 'smo_highscore';
const KEY_SETTINGS = 'smo_settings';

export interface Settings {
  muted: boolean;
  reducedMotion: boolean;
}

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
    if (raw) return { muted: false, reducedMotion: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { muted: false, reducedMotion: false };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
