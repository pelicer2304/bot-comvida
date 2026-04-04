'use client';

import { BotResponse } from '@/lib/types';

export default function ButtonGroup({ buttons, onSelect }: {
  buttons: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {buttons.map(b => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="px-3 py-1.5 bg-[#00a884] hover:bg-[#06cf9c] text-white text-xs rounded-full transition-colors"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
