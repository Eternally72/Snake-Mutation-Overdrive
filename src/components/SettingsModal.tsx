import type { Settings } from '../game/storage';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onChange, onClose }: Props) {
  return (
    <div className="overlay settings-overlay" onClick={onClose}>
      <div className="settings-box" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-title">设置<span className="label-code" style={{ marginLeft: 10 }}>SYS</span></div>
        <label className="setting-row">
          <span>静音</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => onChange({ ...settings, muted: e.target.checked })}
          />
        </label>
        <div className="setting-row">
          <span>音乐音量</span>
          <div className="slider-wrap">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.musicVolume * 100)}
              disabled={settings.muted}
              onChange={(e) => onChange({ ...settings, musicVolume: Number(e.target.value) / 100 })}
            />
            <b className="slider-val">{Math.round(settings.musicVolume * 100)}%</b>
          </div>
        </div>
        <div className="setting-row">
          <span>音效音量</span>
          <div className="slider-wrap">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.sfxVolume * 100)}
              disabled={settings.muted}
              onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) / 100 })}
            />
            <b className="slider-val">{Math.round(settings.sfxVolume * 100)}%</b>
          </div>
        </div>
        <label className="setting-row">
          <span>减少动态效果（防闪烁）</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => onChange({ ...settings, reducedMotion: e.target.checked })}
          />
        </label>
        <button className="btn-primary" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
