import { useMemo, useState } from "react";
import { Archive, ArrowRight, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { NumberInput, Rule, SelectInput, TextInput } from "./form-controls";
import { calculateScenarioTradeMath, isPlanReady } from "./utils";
import { StatusPill } from "./terminal-ui";
import type { CarryScenarioMode, Direction, EditablePlanField, ResultStatus, SelectOption, SessionPlan, Setup, TechnicalStatus } from "./types";

const directionOptions: SelectOption<Direction>[] = [
  { value: "long", label: "Лонг" },
  { value: "short", label: "Шорт" },
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
  setups,
  onUpdate,
  onArchive,
  onCarry,
  onRemove,
}: {
  item: SessionPlan;
  index: number;
  setups: Setup[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onArchive: (id: number) => void;
  onCarry: (id: number, mode: CarryScenarioMode) => void;
  onRemove: (id: number) => void;
}) {
  const ready = isPlanReady(item);
  const [open, setOpen] = useState(!ready);
  const [carryOpen, setCarryOpen] = useState(false);
  const setupOptions = getScenarioSetupOptions(setups, item);
  const tradeMath = useMemo(() => calculateScenarioTradeMath(item), [item]);
  const quality = getQualityScore(item, tradeMath.rr, ready);
  const stale = item.carryCount >= 5;

  return (
    <div className={`overflow-hidden rounded-3xl border transition ${ready ? "border-emerald-200/18 bg-emerald-200/[0.045]" : "border-white/[0.08] bg-white/[0.025]"}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-4 text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={ready ? "emerald" : "amber"}>{ready ? "Готов" : "Черновик"}</StatusPill>
              <StatusPill>{item.setupName || "Сетап не выбран"}</StatusPill>
              <StatusPill tone={item.direction === "long" ? "emerald" : item.direction === "short" ? "red" : "cyan"}>{directionLabel(item.direction)}</StatusPill>
              {item.carryCount > 0 && <StatusPill tone={stale ? "amber" : "neutral"}>Переносов: {item.carryCount}</StatusPill>}
            </div>
            <div className="mt-3 text-lg font-semibold text-neutral-100">Сценарий {index + 1}</div>
            <div className="mt-1 text-sm text-neutral-500">{item.entryZone || "Зона входа не заполнена"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
            <ScenarioBadge label="RR" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} tone={tradeMath.rr >= 1.5 ? "emerald" : tradeMath.rr > 0 ? "amber" : "neutral"} />
            <ScenarioBadge label="Риск" value={item.tradeRisk ? `$${Number(item.tradeRisk || 0).toFixed(0)}` : "—"} tone="amber" />
            <ScenarioBadge label="Качество" value={`${quality}%`} tone={quality >= 75 ? "emerald" : quality >= 45 ? "amber" : "red"} />
            <div className="flex items-center justify-end">
              <ChevronDown className={`h-5 w-5 text-neutral-500 transition ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.08] p-4 pt-5">
          {stale && (
            <div className="mb-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] px-4 py-3 text-sm text-amber-100">
              Сценарий переносился несколько дней и может быть уже неактуален.
            </div>
          )}

          {item.carriedFromDate && (
            <div className="mb-4 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-neutral-500">
              Перенесён с даты {item.carriedFromDate}. Исходный сценарий: {item.originScenarioId ?? "—"}.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <SelectInput
              label="Сетап"
              value={item.setupId}
              setValue={(value) => {
                const setup = setupOptions.find((option) => option.value === value);
                onUpdate(item.id, "setupId", value);
                onUpdate(item.id, "setupName", setup?.label.replace(" (скрыт)", "") ?? item.setupName);
              }}
              options={setupOptions}
            />
            <SelectInput label="Направление" value={item.direction} setValue={(value) => onUpdate(item.id, "direction", value)} options={directionOptions} />
            <TextInput label="Зона / точка входа" value={item.entryZone} setValue={(value) => onUpdate(item.id, "entryZone", value)} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <TextInput label="Триггер входа" value={item.trigger} setValue={(value) => onUpdate(item.id, "trigger", value)} />
            <TextInput label="Стоп" value={item.stop} setValue={(value) => onUpdate(item.id, "stop", value)} />
            <TextInput label="Тейк" value={item.take} setValue={(value) => onUpdate(item.id, "take", value)} />
          </div>

          <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Сделка по сценарию</div>
                <div className="mt-1 text-sm text-neutral-500">Лотность, риск и R:R считаются по тех. параметрам.</div>
              </div>
              <StatusPill tone={tradeMath.hasData ? "emerald" : "neutral"}>{tradeMath.hasData ? "Расчёт готов" : "Нет расчёта"}</StatusPill>
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

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextAreaField
              label="Комментарий / отмена сценария"
              value={item.note}
              onChange={(value) => onUpdate(item.id, "note", value)}
              placeholder="Если уровень пробит без ретеста — не вхожу; если есть резкая новость — жду 15 минут"
            />
            <TextAreaField
              label="Комментарий для архива"
              value={item.archiveComment}
              onChange={(value) => onUpdate(item.id, "archiveComment", value)}
              placeholder="Что сработало / что нарушила / почему входа не было"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SelectInput label="Итог" value={item.resultStatus} setValue={(value) => onUpdate(item.id, "resultStatus", value)} options={resultOptions} />
            <SelectInput label="Техничная сделка?" value={item.technical} setValue={(value) => onUpdate(item.id, "technical", value)} options={technicalOptions} />
            <NumberInput label="Финрезультат, $" value={item.finalResult} setValue={(value) => onUpdate(item.id, "finalResult", value)} />
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <div className="relative">
              <Button onClick={() => setCarryOpen((value) => !value)} variant="outline" className="rounded-xl border border-sky-200/20 bg-sky-200/[0.06] text-sky-100 hover:bg-sky-200/[0.1]">
                <ArrowRight className="mr-2 h-4 w-4" />
                Перенести
              </Button>
              {carryOpen && (
                <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-2xl border border-white/[0.08] bg-[#111317]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl">
                  <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Перенос на завтра</div>
                  <CarryOptionButton
                    title="Только сценарий"
                    detail="Сетап, уровни, триггер и заметки. Торговый расчёт будет очищен."
                    onClick={() => {
                      onCarry(item.id, "scenario");
                      setCarryOpen(false);
                    }}
                  />
                  <CarryOptionButton
                    title="Сценарий + график"
                    detail="Дополнительно скопирует изображение инструмента на следующую дату."
                    onClick={() => {
                      onCarry(item.id, "scenario_image");
                      setCarryOpen(false);
                    }}
                  />
                  <CarryOptionButton
                    title="Сценарий + торговый план"
                    detail="Сохранит расчёт сделки, риск, лотность и причину входа."
                    onClick={() => {
                      onCarry(item.id, "scenario_trade_plan");
                      setCarryOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
            <Button onClick={() => onArchive(item.id)} variant="outline" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20">
              <Archive className="mr-2 h-4 w-4" />
              В архив
            </Button>
            <Button onClick={() => onRemove(item.id)} variant="outline" className="rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CarryOptionButton({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.06]">
      <div className="text-sm font-semibold text-neutral-100">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-neutral-500">{detail}</div>
    </button>
  );
}

function getScenarioSetupOptions(setups: Setup[], item: SessionPlan): SelectOption[] {
  const activeOptions = setups.filter((setup) => setup.isActive).map((setup) => ({ value: setup.id, label: setup.name }));
  const hasCurrent = activeOptions.some((option) => option.value === item.setupId);
  if (hasCurrent) return activeOptions;

  return [{ value: item.setupId, label: `${item.setupName || "Скрытый сетап"} (скрыт)` }, ...activeOptions];
}

function ScenarioTradeMath({ item }: { item: SessionPlan }) {
  const { hasData, lot, stopDistance, potential, rr } = calculateScenarioTradeMath(item);

  if (!hasData) {
    return <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-500">Заполни вход, тех. стоп, тех. тейк, риск и стоимость пункта.</div>;
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

function ScenarioBadge({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "red" | "neutral" }) {
  const toneClass = tone === "emerald" ? "text-emerald-100" : tone === "amber" ? "text-amber-100" : tone === "red" ? "text-rose-100" : "text-neutral-200";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}

function directionLabel(direction: Direction) {
  if (direction === "long") return "Лонг";
  if (direction === "short") return "Шорт";
  return "Оба";
}

function getQualityScore(item: SessionPlan, rr: number, ready: boolean) {
  let score = ready ? 45 : 10;
  if (item.setupId) score += 10;
  if (rr >= 1.5) score += 20;
  if (Number(item.tradeRisk) > 0) score += 10;
  if (item.note.trim().length > 10) score += 10;
  if (item.archiveComment.trim().length > 10 || item.resultStatus !== "not_taken") score += 5;
  return Math.min(100, score);
}
