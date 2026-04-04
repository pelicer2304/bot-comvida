'use client';

import { BotResponse } from '@/lib/types';
import ButtonGroup from './ButtonGroup';
import OptionList from './OptionList';

export default function ChatMessage({ role, responses, text, onAction }: {
  role: 'user' | 'bot';
  text?: string;
  responses?: BotResponse[];
  onAction: (id: string) => void;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-1">
        <div className="max-w-[70%] px-3 py-2 rounded-lg rounded-tr-none bg-[#005c4b] text-sm">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start mb-1 gap-1">
      {responses?.map((r, i) => (
        <div key={i} className="max-w-[70%]">
          {r.type === 'text' && r.text && (
            <div className="px-3 py-2 rounded-lg rounded-tl-none bg-[#202c33] text-sm">
              <p className="whitespace-pre-wrap">{r.text}</p>
            </div>
          )}
          {r.type === 'buttons' && (
            <div className="px-3 py-2 rounded-lg rounded-tl-none bg-[#202c33] text-sm">
              {r.text && <p className="whitespace-pre-wrap mb-1">{r.text}</p>}
              <ButtonGroup buttons={r.buttons} onSelect={onAction} />
            </div>
          )}
          {r.type === 'list' && (
            <div className="px-3 py-2 rounded-lg rounded-tl-none bg-[#202c33] text-sm">
              {r.text && <p className="whitespace-pre-wrap mb-1">{r.text}</p>}
              <OptionList buttonLabel={r.buttonLabel} sections={r.sections} onSelect={onAction} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
