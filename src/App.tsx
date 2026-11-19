import { useCallback, useEffect, useState } from 'react';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import SettingsModal from './components/SettingsModal';
import { initAudio, setMuted, setMusicVolume, setSfxVolume, sfx } from './game/audio';
import { loadHighScore, loadSettings, saveHighScore, saveSettings, type Settings } from './game/storage';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [highScore, setHighScore] = useState<number>(loadHighScore);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setMuted(settings.muted);
    setMusicVolume(settings.musicVolume);
    setSfxVolume(settings.sfxVolume);
    saveSettings(settings);
  }, [settings]);

  const startGame = useCallback(() => {
    initAudio();
    setMuted(settings.muted);
    sfx.start();
    setScreen('game');
  }, [settings.muted]);

  const onGameEnd = useCallback((score: number) => {
    setHighScore((prev) => {
      const best = saveHighScore(score);
      return Math.max(prev, best);
    });
  }, []);

  return (
    <div className="app">
      {screen === 'menu' ? (
        <StartScreen
          highScore={highScore}
          onStart={startGame}
          onOpenSettings={() => {
            initAudio();
            setShowSettings(true);
          }}
        />
      ) : (
        <GameScreen
          highScore={highScore}
          settings={settings}
          onGameEnd={onGameEnd}
          onExit={() => setScreen('menu')}
        />
      )}
      {showSettings && (
        <SettingsModal settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
