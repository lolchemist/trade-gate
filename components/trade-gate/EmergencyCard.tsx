import { Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "./form-controls";

export function EmergencyCard({
  note,
  onNoteChange,
  onEmergency,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onEmergency: () => void;
}) {
  return (
    <Card className="rounded-[2rem] border border-red-400/20 bg-red-500/[0.07] shadow-2xl shadow-red-950/20 backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<Siren className="h-4 w-4 text-red-300" />} title="Экстренная блокировка" />
        <Button
          type="button"
          onClick={onEmergency}
          variant="outline"
          className="h-auto w-full rounded-2xl border border-red-400/40 bg-red-500/20 px-4 py-4 text-base font-semibold text-red-100 hover:bg-red-500/30"
        >
          Я хочу отбиться
        </Button>
        <div className="rounded-xl border border-red-400/20 bg-black/25 px-3 py-2 text-sm text-red-100">
          Ты сейчас торгуешь не рынок, а своё состояние. Закрой терминал и сделай разбор.
        </div>
        <label className="block">
          <div className="mb-1 text-sm text-neutral-300">Что я сейчас пытаюсь вернуть?</div>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-red-400/30"
          />
        </label>
      </CardContent>
    </Card>
  );
}
