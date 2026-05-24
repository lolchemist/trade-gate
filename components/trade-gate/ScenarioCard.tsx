import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, CloudUpload, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPointValueLabel } from "@/constants/instrumentDefaults";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { ArgumentSelector } from "./ArgumentSelector";
import { EntryMethodSelector } from "./EntryMethodSelector";
import { NumberInput, Rule, SelectInput, TextInput } from "./form-controls";
import { useExecutionQuality } from "@/hooks/trade-gate/useExecutionQuality";
import { useScenarioDiagnostic } from "@/hooks/trade-gate/useScenarioDiagnostics";
import { calculateScenarioTradeMath, getPlanEntryMethod, getScenarioArguments, isPlanReady } from "./utils";
import { StatusPill } from "./terminal-ui";
import type {
  CarryScenarioMode,
  Direction,
  EditablePlanField,
  EditableTradeField,
  ResultStatus,
  ScenarioTrade,
  SelectOption,
  SessionPlan,
  StorageSaveResult,
  TechnicalStatus,
  TradeArgument,
  TradeExecutionStatus,
  TradeExecutionType,
} from "./types";

const directionOptions: SelectOption<Direction>[] = [
  { value: "long", label: "Лонг" },
  { value: "short", label: "Шорт" },
  { value: "both", label: "Оба сценария" },
];

const resultOptions = Object.entries(RESULT_STATUS_LABELS).map(([value, label]) => ({
  value: value as ResultStatus,
  label,
}));

const closeResultOptions = resultOptions.filter((option) => option.value !== "not_taken");

const executionStatusOptions: SelectOption<TradeExecutionStatus>[] = [
  { value: "planned", label: "Запланирована" },
  { value: "executed", label: "Исполнена" },
  ...resultOptions,
];

const technicalOptions = Object.entries(TECHNICAL_STATUS_LABELS).map(([value, label]) => ({
  value: value as TechnicalStatus,
  label,
}));

export function ScenarioCard({
  item,
  index,
  tradeArguments,
  hasChartImage,
  onUpdate,
  onAddTrade,
  onUpdateTrade,
  onRemoveTrade,
  onClose,
  onReopen,
  onCarry,
  onRemove,
  onSaveNow,
}: {
  item: SessionPlan;
  index: number;
  tradeArguments: TradeArgument[];
  hasChartImage: boolean;
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onAddTrade: (scenarioId: number, executionType: TradeExecutionType) => void;
  onUpdateTrade: <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => void;
  onRemoveTrade: (scenarioId: number, tradeId: string) => void;
  onClose: (id: number) => void;
  onReopen: (id: number) => void;
  onCarry: (id: number, mode: CarryScenarioMode) => void;
  onRemove: (id: number) => void;
  onSaveNow: () => Promise<StorageSaveResult | null>;
}) {
  const ready = isPlanReady(item);
  const [open, setOpen] = useState(!ready);
  const [carryOpen, setCarryOpen] = useState(false);
  const [manualSaveState, setManualSaveState] = useState<"idle" | "saving" | "saved" | "local" | "error">("idle");
  const tradeMath = useMemo(() => calculateScenarioTradeMath(item), [item]);
  const diagnostic = useScenarioDiagnostic(item, hasChartImage);
  const { validation, quality } = diagnostic;
  const stale = item.carryCount >= 5;
  const scenarioArguments = getScenarioArguments(item);
  const entryMethod = getPlanEntryMethod(item);
  const closed = item.status === "closed";
  const canClose = canCloseScenario(item);
  const saveButtonLabel =
    manualSaveState === "saving"
      ? "Сохраняю..."
      : manualSaveState === "saved"
        ? "Сохранено"
        : manualSaveState === "local"
          ? "Локально"
          : manualSaveState === "error"
            ? "Ошибка"
            : "Сохранить";
  const saveButtonLongLabel =
    manualSaveState === "saving"
      ? "Сохраняю..."
      : manualSaveState === "saved"
        ? "Сохранено"
        : manualSaveState === "local"
          ? "Сохранено локально"
          : manualSaveState === "error"
            ? "Ошибка сохранения"
            : "Сохранить в облако";

  useEffect(() => {
    if (manualSaveState === "idle" || manualSaveState === "saving") return;
    const timeout = window.setTimeout(() => setManualSaveState("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [manualSaveState]);

  const handleSaveNow = async () => {
    if (manualSaveState === "saving") return;
    setManualSaveState("saving");
    const result = await onSaveNow();
    if (result?.source === "supabase" && result.status === "Synced") {
      setManualSaveState("saved");
      return;
    }
    if (result?.source === "localStorage") {
      setManualSaveState("local");
      return;
    }
    setManualSaveState("error");
  };

  return (
    <div className={`overflow-hidden rounded-3xl border transition ${closed ? "border-neutral-300/15 bg-white/[0.025] opacity-90" : ready ? "border-emerald-200/18 bg-emerald-200/[0.045]" : "border-white/[0.08] bg-white/[0.025]"}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-4 text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={ready ? "emerald" : "amber"}>{ready ? "Готов" : "Черновик"}</StatusPill>
              <StatusPill tone={lifecycleTone(item.status)}>{lifecycleLabel(item.status)}</StatusPill>
              {entryMethod && <StatusPill tone="cyan">{entryMethod}</StatusPill>}
              <StatusPill tone={item.direction === "long" ? "emerald" : item.direction === "short" ? "red" : "cyan"}>{directionLabel(item.direction)}</StatusPill>
              {item.carryCount > 0 && <StatusPill tone={stale ? "amber" : "neutral"}>Переносов: {item.carryCount}</StatusPill>}
            </div>
            <div className="mt-3 text-lg font-semibold text-neutral-100">Сценарий {index + 1}</div>
            <div className="mt-1 text-sm text-neutral-500">{item.entryZone || "Зона входа не заполнена"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
            <ScenarioBadge label="RR" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} tone={tradeMath.rr >= 3 ? "emerald" : tradeMath.rr > 0 ? "amber" : "neutral"} />
            <ScenarioBadge label="Арг." value={`${validation.argumentCount}/2`} tone={validation.argumentCount >= 2 ? "emerald" : "amber"} />
            <ScenarioBadge label="Риск ok" value={validation.riskValid ? "Да" : "Нет"} tone={validation.riskValid ? "emerald" : "amber"} />
            <ScenarioBadge label="RR ok" value={validation.rrValid ? "Да" : "Нет"} tone={validation.rrValid ? "emerald" : "amber"} />
            <ScenarioBadge label="Сумма" value={item.tradeRisk ? `$${Number(item.tradeRisk || 0).toFixed(0)}` : "—"} tone="amber" />
            {closed ? <ScenarioBadge label="Факт" value={item.finalResult ? `$${Number(item.finalResult || 0).toFixed(0)}` : "—"} tone={Number(item.finalResult) >= 0 ? "emerald" : "red"} /> : null}
            <ScenarioBadge label="Качество" value={`${quality.score}%`} tone={quality.score >= 75 ? "emerald" : quality.score >= 45 ? "amber" : "red"} />
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

          {!ready && validation.reasons.length > 0 && (
            <div className="mb-4 grid gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 md:grid-cols-[1fr_1fr]">
              <MissingList title="Что не хватает" items={diagnostic.missing} />
              <MissingList title="Что исправить" items={diagnostic.fixes.slice(0, 6)} />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <SelectInput label="Направление" value={item.direction} setValue={(value) => onUpdate(item.id, "direction", value)} options={directionOptions} />
            <TextInput label="Зона / точка входа" value={item.entryZone} setValue={(value) => onUpdate(item.id, "entryZone", value)} />
          </div>

          <div className="mt-3">
            <ArgumentSelector item={item} availableArguments={tradeArguments.map((argument) => argument.name)} selectedArguments={scenarioArguments} onUpdate={onUpdate} />
          </div>

          <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">A. Планирование сценария</div>
                <div className="mt-1 text-sm text-neutral-500">Гипотеза, плановый риск, технические уровни, лот и R:R.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={tradeMath.hasData ? "emerald" : "neutral"}>{tradeMath.hasData ? "Расчёт готов" : "Нет расчёта"}</StatusPill>
                <Button
                  type="button"
                  onClick={() => void handleSaveNow()}
                  disabled={manualSaveState === "saving"}
                  variant="outline"
                  className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1]"
                >
                  <CloudUpload className="mr-2 h-4 w-4" />
                  {saveButtonLongLabel}
                </Button>
              </div>
            </div>

            <EntryMethodSelector item={item} onUpdate={onUpdate} />

            <div className="grid gap-3 md:grid-cols-5">
              <NumberInput label="Плановый вход" value={item.tradeEntry} setValue={(value) => onUpdate(item.id, "tradeEntry", value)} />
              <NumberInput label="Плановый стоп" value={item.tradeStop} setValue={(value) => onUpdate(item.id, "tradeStop", value)} />
              <NumberInput label="Плановый тейк" value={item.tradeTake} setValue={(value) => onUpdate(item.id, "tradeTake", value)} />
              <NumberInput label="Плановый риск, $" value={item.tradeRisk} setValue={(value) => onUpdate(item.id, "tradeRisk", value)} />
              <NumberInput label={getPointValueLabel(item.symbol)} value={item.tradePointValue} setValue={(value) => onUpdate(item.id, "tradePointValue", value)} />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TextInput label="Инвалидация сценария" value={item.scenarioInvalidation} setValue={(value) => onUpdate(item.id, "scenarioInvalidation", value)} />
              <NumberInput label="Уверенность, %" value={item.scenarioConfidence} setValue={(value) => onUpdate(item.id, "scenarioConfidence", value)} />
              <NumberInput label="Аллокация риска, $" value={item.riskBudgetAllocation} setValue={(value) => onUpdate(item.id, "riskBudgetAllocation", value)} />
            </div>

            <ScenarioTradeMath item={item} />
          </div>

          <div className="mt-4 rounded-3xl border border-white/[0.08] bg-black/20 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">B. Исполнения / сделки</div>
                <div className="mt-1 text-sm text-neutral-500">Фактические попытки внутри одной торговой гипотезы.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => onAddTrade(item.id, "trade_1")}
                  disabled={!ready}
                  variant="outline"
                  className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Trade 1
                </Button>
                <Button
                  type="button"
                  onClick={() => onAddTrade(item.id, "re_entry")}
                  disabled={!ready}
                  variant="outline"
                  className="rounded-xl border border-sky-200/20 bg-sky-200/[0.06] text-sky-100 hover:bg-sky-200/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Re-entry
                </Button>
              </div>
            </div>
            {!ready && <div className="mb-3 rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] px-4 py-3 text-sm text-amber-100">Сделку можно добавить только после готового сценария.</div>}
            {(item.trades ?? []).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-neutral-500">Пока нет фактических исполнений. Добавь Trade 1 после подготовки сценария.</div>
            ) : (
              <div className="space-y-3">
                {(item.trades ?? []).map((trade, tradeIndex) => (
                  <ExecutionTradeCard
                    key={trade.id}
                    trade={trade}
                    scenario={item}
                    index={tradeIndex}
                    scenarioId={item.id}
                    onUpdateTrade={onUpdateTrade}
                    onRemoveTrade={onRemoveTrade}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Закрытие сделки</div>
                <div className="mt-1 text-sm text-neutral-500">Сначала фиксируем итог внутри дня. В архив сценарий уйдёт только при закрытии торгового дня.</div>
              </div>
              {closed && <StatusPill tone="neutral">Закрыта {item.closedAt || "—"}</StatusPill>}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectInput label="Итог" value={item.resultStatus} setValue={(value) => onUpdate(item.id, "resultStatus", value)} options={closeResultOptions} />
              <NumberInput label="Финрезультат, $" value={item.finalResult} setValue={(value) => onUpdate(item.id, "finalResult", value)} />
              <SelectInput label="Техничность" value={item.technical} setValue={(value) => onUpdate(item.id, "technical", value)} options={technicalOptions} />
            </div>

            <div className="mt-3">
              <TextAreaField
                label="Комментарий закрытия"
                value={item.closeComment ?? ""}
                onChange={(value) => onUpdate(item.id, "closeComment", value)}
                placeholder="Почему сценарий закрыт, что было исполнено, что не трогать до закрытия дня"
              />
            </div>

            {closed ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-sm text-neutral-400">
                  Зафиксировано: <span className="text-neutral-100">{RESULT_STATUS_LABELS[item.resultStatus] ?? item.resultStatus}</span> · {item.finalResult ? `$${item.finalResult}` : "$0"}
                </div>
                <Button type="button" onClick={() => onReopen(item.id)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Вернуть в план
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs leading-relaxed text-neutral-500">
                  Для закрытия нужен итог, финрезультат и техничность. Без входа можно закрыть с результатом 0.
                </div>
                <Button
                  type="button"
                  onClick={() => onClose(item.id)}
                  disabled={!canClose}
                  variant="outline"
                  className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Сделка закрыта
                </Button>
              </div>
            )}
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

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => void handleSaveNow()}
              disabled={manualSaveState === "saving"}
              variant="outline"
              className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1]"
            >
              <CloudUpload className="mr-2 h-4 w-4" />
              {saveButtonLabel}
            </Button>
            <div className="relative">
              <Button onClick={() => setCarryOpen((value) => !value)} variant="outline" className="rounded-xl border border-sky-200/20 bg-sky-200/[0.06] text-sky-100 hover:bg-sky-200/[0.1]">
                <ArrowRight className="mr-2 h-4 w-4" />
                Перенести сценарий
              </Button>
              {carryOpen && (
                <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-2xl border border-white/[0.08] bg-[#111317]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl">
                  <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Перенос этого сценария</div>
                  <CarryOptionButton
                    title="Только сценарий"
                    detail="Аргументы, уровни, способ входа и заметки. Расчёт сделки будет очищен."
                    onClick={() => {
                      onCarry(item.id, "scenario");
                      setCarryOpen(false);
                    }}
                  />
                  <CarryOptionButton
                    title="Сценарий + график"
                    detail="Дополнительно скопирует график этого инструмента на следующую торговую дату."
                    onClick={() => {
                      onCarry(item.id, "scenario_image");
                      setCarryOpen(false);
                    }}
                  />
                  <CarryOptionButton
                    title="Сценарий + расчёт сделки"
                    detail="Сохранит плановый вход, стоп, тейк, риск и лотность только для этого сценария."
                    onClick={() => {
                      onCarry(item.id, "scenario_trade_plan");
                      setCarryOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
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
function ExecutionTradeCard({
  scenario,
  trade,
  index,
  scenarioId,
  onUpdateTrade,
  onRemoveTrade,
}: {
  scenario: SessionPlan;
  trade: ScenarioTrade;
  index: number;
  scenarioId: number;
  onUpdateTrade: <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => void;
  onRemoveTrade: (scenarioId: number, tradeId: string) => void;
}) {
  const title = trade.executionType === "trade_1" ? "Trade 1" : `Re-entry ${index}`;
  const executionQuality = useExecutionQuality({ scenario, trade });

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={trade.status === "take" || trade.status === "manual_profit" ? "emerald" : trade.status === "stop" || trade.status === "manual_loss" ? "red" : "neutral"}>{title}</StatusPill>
          <StatusPill>{executionStatusLabel(trade.status)}</StatusPill>
          <StatusPill tone={executionQuality.score >= 75 ? "emerald" : executionQuality.score >= 50 ? "amber" : "neutral"}>{executionQuality.label} · {executionQuality.score}%</StatusPill>
        </div>
        <Button type="button" onClick={() => onRemoveTrade(scenarioId, trade.id)} variant="outline" className="rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SelectInput label="Статус исполнения" value={trade.status} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "status", value)} options={executionStatusOptions} />
        <NumberInput label="Факт вход" value={trade.actualEntry} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualEntry", value)} />
        <NumberInput label="Факт выход" value={trade.actualExit} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualExit", value)} />
        <NumberInput label="Факт размер" value={trade.actualSize} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualSize", value)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <NumberInput label="Факт стоп" value={trade.actualStop} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualStop", value)} />
        <NumberInput label="Факт тейк" value={trade.actualTake} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualTake", value)} />
        <NumberInput label="Факт риск, $" value={trade.actualRisk} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualRisk", value)} />
        <NumberInput label="Финрезультат, $" value={trade.actualResult} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualResult", value)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <NumberInput label="Факт R:R" value={trade.actualRr} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "actualRr", value)} />
        <NumberInput label="Отклонение / slippage" value={trade.slippage} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "slippage", value)} />
        <SelectInput label="Техничность исполнения" value={trade.technical} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "technical", value)} options={technicalOptions} />
        <TextInput label="Время исполнения" value={trade.executedAt} setValue={(value) => onUpdateTrade(scenarioId, trade.id, "executedAt", value)} />
      </div>

      <div className="mt-3">
        <TextAreaField
          label="Заметки по исполнению"
          value={trade.executionNotes}
          onChange={(value) => onUpdateTrade(scenarioId, trade.id, "executionNotes", value)}
          placeholder="Что реально произошло: качество входа, эмоции, отклонения от плана"
        />
      </div>
    </div>
  );
}

function MissingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/70">{title}</div>
        <div className="text-sm text-neutral-400">Критичных пробелов нет.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/70">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="text-sm text-amber-50/90">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
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

function executionStatusLabel(status: TradeExecutionStatus) {
  if (status === "planned") return "Запланирована";
  if (status === "executed") return "Исполнена";
  return RESULT_STATUS_LABELS[status] ?? status;
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

function lifecycleLabel(status: SessionPlan["status"]) {
  if (status === "active") return "Активна";
  if (status === "closed") return "Закрыта";
  if (status === "archived") return "Архив";
  return "План";
}

function lifecycleTone(status: SessionPlan["status"]): "emerald" | "amber" | "red" | "neutral" | "cyan" {
  if (status === "active") return "cyan";
  if (status === "closed") return "neutral";
  if (status === "archived") return "amber";
  return "neutral";
}

function canCloseScenario(item: SessionPlan) {
  if (item.status === "closed" || item.status === "archived") return false;
  if (item.resultStatus === "not_taken") return false;
  if (!item.technical) return false;
  if (item.resultStatus === "no_entry") return true;
  return item.finalResult.trim().length > 0;
}
