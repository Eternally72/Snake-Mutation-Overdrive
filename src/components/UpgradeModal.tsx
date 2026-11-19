import { useEffect, useRef, useState } from 'react';
import { UPGRADE_MAP } from '../game/config';
import type { UpgradeId } from '../game/types';

interface Props {
  choices: UpgradeId[];
  onChoose: (id: UpgradeId) => void;
}

const SCHOOL_NAMES: Record<string, string> = {
  red: '狂热系',
  blue: '幻影系',
  green: '蜕变系',
  chain: '连锁系',
  general: '通用',
};

export default function UpgradeModal({ choices, onChoose }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const committed = useRef(false);

  const choose = (index: number) => {
    if (committed.current || index < 0 || index >= choices.length) return;
    committed.current = true;
    setPicked(index);
    // let the collapse-to-center animation play, then commit
    window.setTimeout(() => onChoose(choices[index]), 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) choose(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices]);

  return (
    <div className="overlay upgrade-overlay">
      <div className="overlay-title">基因强化</div>
      <div className="overlay-sub">选择一张强化卡（按 1 / 2 / 3）</div>
      <div className="upgrade-cards">
        {choices.map((id, i) => {
          const def = UPGRADE_MAP[id];
          const state = picked === null ? '' : picked === i ? ' picked' : ' faded';
          return (
            <button
              key={id}
              className={`upgrade-card school-${def.school}${state}`}
              onClick={() => choose(i)}
            >
              <span className="card-key">{i + 1}</span>
              <div className="card-school">{SCHOOL_NAMES[def.school]}</div>
              <div className="card-icon">{schoolIcon(def.school)}</div>
              <div className="card-name">{def.name}</div>
              <div className="card-desc">{def.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function schoolIcon(school: string): string {
  switch (school) {
    case 'red':
      return '🔥';
    case 'blue':
      return '❄';
    case 'green':
      return '🧬';
    case 'chain':
      return '⚡';
    default:
      return '★';
  }
}
