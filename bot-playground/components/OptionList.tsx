'use client';

import { useState } from 'react';

interface Section { title: string; rows: { id: string; title: string; description?: string }[] }

export default function OptionList({ buttonLabel, sections, onSelect }: {
  buttonLabel: string;
  sections: Section[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 bg-[#2a3942] hover:bg-[#3a4a54] text-[#00a884] text-xs rounded-lg border border-[#00a884] transition-colors w-full"
      >
        {buttonLabel}
      </button>
      {open && (
        <div className="mt-1 bg-[#1a2730] rounded-lg border border-[#2a3942] max-h-60 overflow-y-auto">
          {sections.map(s => (
            <div key={s.title}>
              <div className="px-3 py-1.5 text-[#8696a0] text-[10px] uppercase tracking-wider">{s.title}</div>
              {s.rows.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onSelect(r.id); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-[#2a3942] transition-colors"
                >
                  <div className="text-[#e9edef] text-xs">{r.title}</div>
                  {r.description && <div className="text-[#8696a0] text-[10px]">{r.description}</div>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
