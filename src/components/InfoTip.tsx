import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  color?: string;
  desc?: string;
  children: React.ReactNode;
}

const TIP_W = 252;
const TIP_H = 168;
const GAP = 10;
const SHOW_DELAY = 90;

export default function InfoTip({ title, color = '#43BFFF', desc, children }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const cancelTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const hide = () => {
    cancelTimer();
    setPos(null);
  };

  // grace period so the cursor can travel into the tip to scroll long content
  const scheduleHide = () => {
    cancelTimer();
    timer.current = window.setTimeout(hide, 180);
  };

  const place = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let x = r.right + GAP;
    if (x + TIP_W > window.innerWidth - 8) x = r.left - GAP - TIP_W;
    if (x < 8) x = Math.min(Math.max(8, r.left + r.width / 2 - TIP_W / 2), Math.max(8, window.innerWidth - TIP_W - 8));
    let y = r.top + r.height / 2 - TIP_H / 2;
    y = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - TIP_H - 8));
    setPos({ x, y });
  };

  const show = () => {
    cancelTimer();
    if (pos) return;
    timer.current = window.setTimeout(place, SHOW_DELAY);
  };

  return (
    <div className="info-anchor" ref={anchorRef} onMouseEnter={show} onMouseLeave={scheduleHide}>
      {children}
      {pos &&
        createPortal(
          <div
            className="info-tip"
            style={{ left: pos.x, top: pos.y, width: TIP_W, maxHeight: TIP_H, '--tip-color': color } as React.CSSProperties}
            onMouseEnter={cancelTimer}
            onMouseLeave={hide}
          >
            <div className="info-tip-glow" />
            <div className="info-tip-title">{title}</div>
            {desc && <div className="info-tip-body">{desc}</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
