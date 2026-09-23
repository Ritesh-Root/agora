import React, { useEffect, useState } from 'react';
import { onReplayChange, replayActive, replaySpeed, setReplaySpeed } from '../replay/playReplay';

const SPEEDS = [1, 2, 4] as const;

/** 1x / 2x / 4x control shown while a recorded run is playing. No relay and no API key. */
const ReplayBar: React.FC = () => {
  const [active, setActive] = useState(replayActive());
  const [speed, setSpeed] = useState(replaySpeed());

  useEffect(() => onReplayChange(() => {
    setActive(replayActive());
    setSpeed(replaySpeed());
  }), []);

  if (!active) return null;

  return (
    <div
      data-testid="replay-bar"
      className="fixed top-16 left-1/2 z-40 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/95 border border-zinc-200 px-2 py-1 shadow-lg"
    >
      <span className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Replay</span>
      {SPEEDS.map((value) => (
        <button
          key={value}
          type="button"
          data-testid={`replay-speed-${value}x`}
          aria-label={`${value}x`}
          onClick={() => setReplaySpeed(value)}
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer ${speed === value ? 'bg-ink text-white' : 'text-zinc-500 hover:text-ink'}`}
        >
          {value}x
        </button>
      ))}
    </div>
  );
};

export default ReplayBar;
