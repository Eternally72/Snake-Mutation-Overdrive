// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubCanvas() {
  const gradient = { addColorStop: () => {} };
  const ctxProxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
        if (prop === 'canvas') return { width: 600, height: 600 };
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxProxy as unknown as RenderingContext);
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mount(node: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UI 冒烟测试', () => {
  it('开始界面挂载并显示标题与最高分', async () => {
    stubCanvas();
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    const StartScreen = (await import('../src/components/StartScreen')).default;
    const { container } = await mount(
      React.createElement(StartScreen, { highScore: 1234, onStart: () => {}, onOpenSettings: () => {} }),
    );
    expect(container.textContent).toContain('失控进化');
    expect(container.textContent).toContain('1,234');
  });

  it('游戏界面挂载，逻辑步进与渲染循环无异常', async () => {
    stubCanvas();
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    const GameScreen = (await import('../src/components/GameScreen')).default;
    const { container } = await mount(
      React.createElement(GameScreen, {
        highScore: 0,
        settings: { muted: true, reducedMotion: false },
        onGameEnd: () => {},
        onExit: () => {},
      }),
    );
    // let a few animation frames run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(container.textContent).toContain('得分');
    expect(container.textContent).toContain('基因连锁');
    // simulate keyboard input
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await new Promise((r) => setTimeout(r, 200));
    });
    // pause via key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(container.textContent).toContain('已暂停');
  });

  it('强化选择界面渲染三张卡且可选择', async () => {
    const UpgradeModal = (await import('../src/components/UpgradeModal')).default;
    let chosen = '';
    const { container } = await mount(
      React.createElement(UpgradeModal, {
        choices: ['redAmp', 'coldCore', 'goldenGluttony'] as never,
        onChoose: (id: string) => {
          chosen = id;
        },
      }),
    );
    expect(container.textContent).toContain('赤红增幅');
    expect(container.textContent).toContain('寒潮核心');
    expect(container.textContent).toContain('黄金吞噬');
    const card = container.querySelector('.upgrade-card') as HTMLElement;
    await act(async () => {
      card.click();
    });
    expect(chosen).toBe('redAmp');
  });

  it('结算界面显示统计并可重开', async () => {
    const GameOverModal = (await import('../src/components/GameOverModal')).default;
    let restarted = false;
    const { container } = await mount(
      React.createElement(GameOverModal, {
        stats: {
          score: 888,
          maxChain: 5,
          maxLength: 22,
          evolutions: 2,
          timeAlive: 95,
          upgrades: [{ id: 'chainAmp', level: 2 }],
        },
        highScore: 999,
        isNewRecord: false,
        victory: false,
        onRestart: () => {
          restarted = true;
        },
        onExit: () => {},
      }),
    );
    expect(container.textContent).toContain('888');
    expect(container.textContent).toContain('5 连');
    expect(container.textContent).toContain('1:35');
    expect(container.textContent).toContain('连锁增幅');
    const btn = container.querySelector('.btn-primary') as HTMLElement;
    await act(async () => {
      btn.click();
    });
    expect(restarted).toBe(true);
  });
});
