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
        <div className="overlay-title">设置</div>
        <label className="setting-row">
          <span>静音</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => onChange({ ...settings, muted: e.target.checked })}
          />
        </label>
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
