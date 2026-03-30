import { useEffect, useState, useRef } from 'react';

interface RestTimerProps {
  seconds: number;
  onDone: () => void;
  onDismiss: () => void;
}

export default function RestTimer({ seconds, onDone, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, seconds));
  const doneRef = useRef(false);

  useEffect(() => {
    setRemaining(Math.max(0, seconds));
    doneRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining, onDone]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <div className="workout-rest-timer" role="status" aria-live="polite">
      <div className="workout-rest-timer__inner">
        <span className="workout-rest-timer__label">Rest</span>
        <span className="workout-rest-timer__time">
          {m}:{s.toString().padStart(2, '0')}
        </span>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onDismiss}>
          Skip
        </button>
      </div>
    </div>
  );
}
