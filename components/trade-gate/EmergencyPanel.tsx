import { Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelHeader, TerminalPanel } from "./terminal-ui";

export function EmergencyPanel({
  note,
  onNoteChange,
  onEmergency,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onEmergency: () => void;
}) {
  return (
    <TerminalPanel className="p-5" glow="red">
      <PanelHeader eyebrow="Аварийный стоп" title="Экстренная блокировка" meta={<Siren className="h-5 w-5 text-rose-200" />} />
      <Button
        type="button"
        onClick={onEmergency}
        variant="outline"
        className="mt-5 h-auto w-full rounded-2xl border border-rose-200/20 bg-rose-200/[0.07] px-4 py-4 text-base font-semibold uppercase tracking-[0.08em] text-rose-50 shadow-sm hover:bg-rose-200/[0.1]"
      >
        Я хочу отбиться
      </Button>
      <div className="mt-4 rounded-2xl border border-rose-200/15 bg-white/[0.035] p-4 text-sm leading-relaxed text-rose-50/80">
        Ты сейчас торгуешь не рынок, а своё состояние. Закрой терминал и сделай разбор.
      </div>
      <label className="mt-4 block">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Что я сейчас пытаюсь вернуть?</div>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-rose-200/20"
        />
      </label>
    </TerminalPanel>
  );
}
