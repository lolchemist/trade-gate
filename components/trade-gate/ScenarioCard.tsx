import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPointValueLabel } from "@/constants/instrumentDefaults";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { NumberInput, Rule, SelectInput, TextInput } from "./form-controls";
import { calculateScenarioTradeMath, getPlanEntryMethod, getPlanSetupLabel, getPlanSetupNames, isPlanReady } from "./utils";
import { StatusPill } from "./terminal-ui";
import type {
  CarryScenarioMode,
  Direction,
  EditablePlanField,
  EditableTradeField,
  EntryMethod,
  ResultStatus,
  ScenarioTrade,
  SelectOption,
  SessionPlan,
  Setup,
  TechnicalStatus,
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
  setups,
  entryMethods,
  onUpdate,
  onAddTrade,
  onUpdateTrade,
  onRemoveTrade,
  onClose,
  onReopen,
  onCarry,
  onRemove,
}: {
  item: SessionPlan;
  index: number;
  setups: Setup[];
  entryMethods: EntryMethod[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onAddTrade: (scenarioId: number, executionType: TradeExecutionType) => void;
  onUpdateTrade: <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => void;
  onRemoveTrade: (scenarioId: number, tradeId: string) => void;
  onClose: (id: number) => void;
  onReopen: (id: number) => void;
  onCarry: (id: number, mode: CarryScenarioMode) => void;
  onRemove: (id: number) => void;
}) {
  const ready = isPlanReady(item);
  const [open, setOpen] = useState(!ready);
  const [carryOpen, setCarryOpen] = useState(false);
  const tradeMath = useMemo(() => calculateScenarioTradeMath(item), [item]);
  const quality = getQualityScore(item, tradeMath.rr, ready);
  const stale = item.carryCount >= 5;
  const setupLabel = getPlanSetupLabel(item);
  const entryMethod = getPlanEntryMethod(item);
  const closed = item.status === "closed";
  const canClose = canCloseScenario(item);

  return (
    <div className={`overflow-hidden rounded-3xl border transition ${closed ? "border-neutral-300/15 bg-white/[0.025] opacity-90" : ready ? "border-emerald-200/18 bg-emerald-200/[0.045]" : "border-white/[0.08] bg-white/[0.025]"}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-4 text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={ready ? "emerald" : "amber"}>{ready ? "Готов" : "Черновик"}</StatusPill>
              <StatusPill tone={lifecycleTone(item.status)}>{lifecycleLabel(item.status)}</StatusPill>
              <StatusPill>{setupLabel}</StatusPill>
              <StatusPill tone={item.direction === "long" ? "emerald" : item.direction === "short" ? "red" : "cyan"}>{directionLabel(item.direction)}</StatusPill>
              {entryMethod && <StatusPill tone="neutral">{entryMethod}</StatusPill>}
              {item.carryCount > 0 && <StatusPill tone={stale ? "amber" : "neutral"}>Переносов: {item.carryCount}</StatusPill>}
            </div>
            <div className="mt-3 text-lg font-semibold text-neutral-100">Сценарий {index + 1}</div>
            <div className="mt-1 text-sm text-neutral-500">{item.entryZone || "Зона входа не заполнена"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
            <ScenarioBadge label="RR" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} tone={tradeMath.rr >= 1.5 ? "emerald" : tradeMath.rr > 0 ? "amber" : "neutral"} />
            <ScenarioBadge label="Риск" value={item.tradeRisk ? `$${Number(item.tradeRisk || 0).toFixed(0)}` : "—"} tone="amber" />
            {closed ? <ScenarioBadge label="Факт" value={item.finalResult ? `$${Number(item.finalResult || 0).toFixed(0)}` : "—"} tone={Number(item.finalResult) >= 0 ? "emerald" : "red"} /> : null}
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
            <SetupMultiSelect item={item} setups={setups} onUpdate={onUpdate} />
            <SelectInput label="Направление" value={item.direction} setValue={(value) => onUpdate(item.id, "direction", value)} options={directionOptions} />
            <TextInput label="Зона / точка входа" value={item.entryZone} setValue={(value) => onUpdate(item.id, "entryZone", value)} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <EntryMethodPicker item={item} entryMethods={entryMethods} onUpdate={onUpdate} />
            <TextInput label="Стоп" value={item.stop} setValue={(value) => onUpdate(item.id, "stop", value)} />
            <TextInput label="Тейк" value={item.take} setValue={(value) => onUpdate(item.id, "take", value)} />
          </div>

          <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">A. Планирование сценария</div>
                <div className="mt-1 text-sm text-neutral-500">Гипотеза, плановый риск, технические уровни, лот и R:R.</div>
              </div>
              <StatusPill tone={tradeMath.hasData ? "emerald" : "neutral"}>{tradeMath.hasData ? "Расчёт готов" : "Нет расчёта"}</StatusPill>
            </div>

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
                    detail="Сетапы, уровни, способ входа и заметки. Торговый расчёт будет очищен."
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
                    detail="Сохранит расчёт сделки, риск, лотность и способ входа."
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

function SetupMultiSelect({
  item,
  setups,
  onUpdate,
}: {
  item: SessionPlan;
  setups: Setup[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
}) {
  const [query, setQuery] = useState("");
  const setupIds = Array.isArray(item.setupIds) ? item.setupIds : [];
  const selectedNames = getPlanSetupNames(item);
  const selected = setupIds.length > 0
    ? setupIds.map((setupId, index) => ({
        id: setupId,
        name: setups.find((setup) => setup.id === setupId)?.name ?? selectedNames[index] ?? "Сетап",
        removable: true,
      }))
    : selectedNames.map((name, index) => ({
        id: `preserved-${item.id}-${index}`,
        name,
        removable: false,
      }));
  const selectedIdSet = new Set(setupIds);
  const normalizedQuery = query.trim().toLowerCase();
  const activeSetups = setups.filter((setup) => setup.isActive === true);
  const filteredSetups = activeSetups.filter((setup) => (normalizedQuery ? setup.name.toLowerCase().includes(normalizedQuery) : true));
  const limitReached = setupIds.length >= 5;

  const addSetup = (setupId: string) => {
    if (limitReached || selectedIdSet.has(setupId)) return;
    onUpdate(item.id, "setupIds", [...setupIds, setupId]);
    setQuery("");
  };

  const removeSetup = (setupId: string) => {
    onUpdate(
      item.id,
      "setupIds",
      setupIds.filter((id) => id !== setupId)
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Сетапы</div>
      <div className="flex min-h-9 flex-wrap gap-2">
        {selected.length === 0 ? (
          <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-xs text-amber-100">Сетап не выбран</span>
        ) : (
          selected.map((setup) => (
            <span key={setup.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-xs text-emerald-100">
              {setup.name}
              {setup.removable && (
                <button type="button" onClick={() => removeSetup(setup.id)} className="rounded-full text-emerald-100/70 transition hover:text-emerald-50" aria-label={`Убрать сетап ${setup.name}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))
        )}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти сетап"
        className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
      {limitReached && <div className="mt-2 text-xs text-amber-100">Можно выбрать до 5 сетапов.</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {filteredSetups.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-neutral-500">
            {activeSetups.length === 0 ? "В плейбуке нет активных сетапов." : "По запросу сетапы не найдены."}
          </div>
        ) : (
          filteredSetups.map((setup) => {
            const selectedAlready = selectedIdSet.has(setup.id);
            const disabled = selectedAlready || (limitReached && !selectedAlready);
            return (
              <button
                key={setup.id}
                type="button"
                onClick={() => addSetup(setup.id)}
                disabled={disabled}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-200/20 hover:bg-emerald-200/[0.07] hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.04] disabled:hover:text-neutral-300"
                title={selectedAlready ? "Уже выбран" : limitReached ? "Можно выбрать до 5 сетапов" : setup.name}
              >
                {setup.name}
                {selectedAlready ? " · выбран" : ""}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function EntryMethodPicker({
  item,
  entryMethods,
  onUpdate,
}: {
  item: SessionPlan;
  entryMethods: EntryMethod[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
}) {
  const current = getPlanEntryMethod(item);
  const [query, setQuery] = useState(current);
  useEffect(() => {
    setQuery(current);
  }, [current]);
  const activeMethods = entryMethods.filter((method) => method.isActive);
  const filteredMethods = activeMethods.filter((method) => method.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  const selectMethod = (method: EntryMethod) => {
    onUpdate(item.id, "entryMethodId", method.id);
    setQuery(method.name);
  };

  const useCustomMethod = () => {
    const value = query.trim();
    if (!value) return;
    onUpdate(item.id, "entryMethod", value);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Способ входа</div>
      {current ? (
        <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200/20 bg-sky-200/[0.07] px-3 py-1.5 text-xs text-sky-100">
          {current}
          <button type="button" onClick={() => onUpdate(item.id, "entryMethod", "")} className="rounded-full text-sky-100/70 transition hover:text-sky-50" aria-label="Очистить способ входа">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <span className="mb-2 inline-flex rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-xs text-amber-100">Не выбран</span>
      )}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={useCustomMethod}
        placeholder="Найти или вписать способ"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {filteredMethods.map((method) => (
          <button key={method.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMethod(method)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 transition hover:border-sky-200/20 hover:bg-sky-200/[0.07] hover:text-sky-100">
            {method.name}
          </button>
        ))}
        {query.trim() && !activeMethods.some((method) => method.name.toLowerCase() === query.trim().toLowerCase()) && (
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={useCustomMethod} className="rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-200/[0.1]">
            Использовать “{query.trim()}”
          </button>
        )}
      </div>
    </div>
  );
}

function ExecutionTradeCard({
  trade,
  index,
  scenarioId,
  onUpdateTrade,
  onRemoveTrade,
}: {
  trade: ScenarioTrade;
  index: number;
  scenarioId: number;
  onUpdateTrade: <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => void;
  onRemoveTrade: (scenarioId: number, tradeId: string) => void;
}) {
  const title = trade.executionType === "trade_1" ? "Trade 1" : `Re-entry ${index}`;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={trade.status === "take" || trade.status === "manual_profit" ? "emerald" : trade.status === "stop" || trade.status === "manual_loss" ? "red" : "neutral"}>{title}</StatusPill>
          <StatusPill>{executionStatusLabel(trade.status)}</StatusPill>
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

function getQualityScore(item: SessionPlan, rr: number, ready: boolean) {
  let score = ready ? 45 : 10;
  if (getPlanSetupNames(item).length > 0) score += 10;
  if (getPlanEntryMethod(item)) score += 5;
  if (rr >= 1.5) score += 20;
  if (Number(item.tradeRisk) > 0) score += 10;
  if (item.note.trim().length > 10) score += 10;
  if (item.archiveComment.trim().length > 10 || (item.trades ?? []).some((trade) => trade.status !== "planned")) score += 5;
  return Math.min(100, score);
}
