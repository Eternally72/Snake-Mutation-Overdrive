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
  return (
    <div className="overlay upgrade-overlay">
      <div className="overlay-title">基因强化</div>
      <div className="overlay-sub">选择一张强化卡</div>
      <div className="upgrade-cards">
        {choices.map((id) => {
          const def = UPGRADE_MAP[id];
          return (
            <button key={id} className={`upgrade-card school-${def.school}`} onClick={() => onChoose(id)}>
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
