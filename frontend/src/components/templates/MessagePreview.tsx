import type { Occasion } from '@/types';
import { useToday } from '@/hooks/useToday';
import { renderTemplate } from '@/utils/message';

const SAMPLE = {
  BIRTHDAY: { name: 'Priya Sharma', years: 30 },
  ANNIVERSARY: { name: 'Ramesh & Sunita Iyer', years: 25 },
} as const;

interface MessagePreviewProps {
  body: string;
  occasion: Occasion;
  name?: string;
}

/** WhatsApp-style bubble rendering a template with sample values. */
export function MessagePreview({ body, occasion, name }: MessagePreviewProps) {
  const today = useToday();
  const sample = SAMPLE[occasion];
  const text = renderTemplate(body, { name: name ?? sample.name, occasion, eventDate: today, years: sample.years });
  return (
    <div className="rounded-2xl bg-[#efeae2] p-4">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3.5 py-2.5 text-[14px] leading-relaxed text-[#111b21] shadow-sm">
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#667781]">Preview with sample name “{name ?? sample.name}”</p>
    </div>
  );
}
