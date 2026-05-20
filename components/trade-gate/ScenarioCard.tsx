import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { NumberInput, Rule, SelectInput, TextInput } from "./form-controls";
import { calculateScenarioTradeMath, isPlanReady } from "./utils";
import type { Direction, EditablePlanField, ResultStatus, SelectOption, SessionPlan, TechnicalStatus } from "./types";

const directionOptions: SelectOption<Direction>[] = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
  { value: "both", label: "Оба сценария" },
];

const resultOptions = Object.entries(RESULT_STATUS_LABELS).map(([value, label]) => ({
  value: value as ResultStatus,
  label,
}));

const technicalOptions = Object.entries(TECHNICAL_STATUS_LABELS).map(([value, label]) => ({
  value: value as TechnicalStatus,
  label,
}));

export function ScenarioCard({
  item,
  index,
  onUpdate,
  onArchive,
  onRemove,
}: {
  item: SessionPlan;
  index: number;
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onArchive: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const ready = isPlanReady(item);

  return (
    <div className={`rounded-2xl border p-4 ${ready ? "border-emerald-400/30 bg-emerald-500/10 text-neutral-100" : "border-white/10 bg-black/25 text-neutral-100"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Сценарий {index + 1}</div>
          <div className="text-xs text-neutral-500">{ready ? "Готов к исполнению" : "Нужно заполнить все ключевые поля"}</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onArchive(item.id)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
            В архив
          </Button>
          <Button onClick={() => onRemove(item.id)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
            <Trash2 className="h-4 w-4 text-red-300" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SelectInput label="Направление" value={item.direction} setValue={(value) => onUpdate(item.id, "direction", value)} options={directionOptions} />
        <TextInput label="Зона / точка входа" value={item.entryZone} setValue={(value) => onUpdate(item.id, "entryZone", value)} />
        <TextInput label="Триггер входа" value={item.trigger} setValue={(value) => onUpdate(item.id, "trigger", value)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextInput label="Стоп" value={item.stop} setValue={(value) => onUpdate(item.id, "stop", value)} />
        <TextInput label="Тейк" value={item.take} setValue={(value) => onUpdate(item.id, "take", value)} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">Сделка по сценарию</div>
            <div className="mt-1 text-xs text-neutral-500">Введи тех. стоп, тейк и допустимый риск — лотность рассчитается автоматически.</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <NumberInput label="Вход" value={item.tradeEntry} setValue={(value) => onUpdate(item.id, "tradeEntry", value)} />
          <NumberInput label="Тех. стоп" value={item.tradeStop} setValue={(value) => onUpdate(item.id, "tradeStop", value)} />
          <NumberInput label="Тех. тейк" value={item.tradeTake} setValue={(value) => onUpdate(item.id, "tradeTake", value)} />
          <NumberInput label="Риск, $" value={item.tradeRisk} setValue={(value) => onUpdate(item.id, "tradeRisk", value)} />
          <NumberInput label="$ / пункт / 1 лот" value={item.tradePointValue} setValue={(value) => onUpdate(item.id, "tradePointValue", value)} />
        </div>

        <ScenarioTradeMath item={item} />
      </div>

      <label className="mt-3 block">
        <div className="mb-1 text-sm text-neutral-300">Комментарий / отмена сценария</div>
        <textarea
          value={item.note}
          onChange={(event) => onUpdate(item.id, "note", event.target.value)}
          placeholder="Например: если уровень пробит без ретеста — не вхожу; если есть резкая новость — жду 15 минут"
          className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
        />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <SelectInput label="Итог" value={item.resultStatus} setValue={(value) => onUpdate(item.id, "resultStatus", value)} options={resultOptions} />
        <SelectInput label="Техничная сделка?" value={item.technical} setValue={(value) => onUpdate(item.id, "technical", value)} options={technicalOptions} />
        <NumberInput label="Финрезультат, $" value={item.finalResult} setValue={(value) => onUpdate(item.id, "finalResult", value)} />
      </div>

      <label className="mt-3 block">
        <div className="mb-1 text-sm text-neutral-300">Комментарий для архива</div>
        <textarea
          value={item.archiveComment}
          onChange={(event) => onUpdate(item.id, "archiveComment", event.target.value)}
          placeholder="Что сработало / что нарушила / почему входа не было / что улучшить завтра"
          className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
        />
      </label>
    </div>
  );
}

function ScenarioTradeMath({ item }: { item: SessionPlan }) {
  const { hasData, lot, stopDistance, potential, rr } = calculateScenarioTradeMath(item);

  if (!hasData) {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-500">
        Заполни вход, тех. стоп, тех. тейк, риск и стоимость пункта — здесь появится расчёт лотности.
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
      <Rule title="Лотность" value={Number.isFinite(lot) ? lot.toFixed(2) : "—"} />
      <Rule title="Стоп, пунктов" value={Number.isFinite(stopDistance) ? stopDistance.toFixed(2) : "—"} />
      <Rule title="Потенциал" value={Number.isFinite(potential) ? `$${potential.toFixed(0)}` : "—"} />
      <Rule title="R:R" value={rr > 0 ? `1:${rr.toFixed(2)}` : "—"} />
    </div>
  );
}
