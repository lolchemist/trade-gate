import { useState } from "react";
import { X } from "lucide-react";
import { dedupeTextList, getPlanArgumentNames, getTradeArgumentNames } from "./utils";
import type { EditablePlanField, SessionPlan, TradeArgument } from "./types";

type SetupSelectorProps = {
  item: SessionPlan;
  tradeArguments: TradeArgument[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
};

export function SetupSelector({ item, tradeArguments, onUpdate }: SetupSelectorProps) {
  const [query, setQuery] = useState("");
  const argumentIds = dedupeTextList(Array.isArray(item.argumentIds) ? item.argumentIds : Array.isArray(item.setupIds) ? item.setupIds : []);
  const selectedNames = getPlanArgumentNames(item);
  const selected =
    argumentIds.length > 0
      ? argumentIds.map((argumentId, index) => ({
          id: argumentId,
          name: tradeArguments.find((argument) => argument.id === argumentId)?.name ?? selectedNames[index] ?? "Аргумент",
          removable: true,
        }))
      : selectedNames.map((name, index) => ({
          id: `preserved-${item.id}-${index}`,
          name,
          removable: false,
        }));
  const selectedIdSet = new Set(argumentIds);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredArguments = tradeArguments.filter((argument) => (normalizedQuery ? argument.name.toLowerCase().includes(normalizedQuery) : true));
  const limitReached = argumentIds.length >= 5;

  const addArgument = (argumentId: string) => {
    if (limitReached || selectedIdSet.has(argumentId)) return;
    onUpdate(item.id, "argumentIds", [...argumentIds, argumentId]);
    setQuery("");
  };

  const removeArgument = (argumentId: string) => {
    onUpdate(
      item.id,
      "argumentIds",
      argumentIds.filter((id) => id !== argumentId)
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Торговый аргумент</div>
      <div className="flex min-h-9 flex-wrap gap-2">
        {selected.length === 0 ? (
          <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-xs text-amber-100">Аргумент не выбран</span>
        ) : (
          selected.map((argument) => (
            <span key={argument.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-xs text-emerald-100">
              {argument.name}
              {argument.removable && (
                <button type="button" onClick={() => removeArgument(argument.id)} className="rounded-full text-emerald-100/70 transition hover:text-emerald-50" aria-label={`Убрать аргумент ${argument.name}`}>
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
        placeholder="Найти аргумент"
        className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
      {limitReached && <div className="mt-2 text-xs text-amber-100">Можно выбрать до 5 аргументов.</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {filteredArguments.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-neutral-500">
            {tradeArguments.length === 0 ? "В списке нет аргументов." : "По запросу аргументы не найдены."}
          </div>
        ) : (
          filteredArguments.map((argument) => {
            const selectedAlready = selectedIdSet.has(argument.id);
            const disabled = selectedAlready || (limitReached && !selectedAlready);
            return (
              <button
                key={argument.id}
                type="button"
                onClick={() => addArgument(argument.id)}
                disabled={disabled}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-200/20 hover:bg-emerald-200/[0.07] hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.04] disabled:hover:text-neutral-300"
                title={selectedAlready ? "Уже выбран" : limitReached ? "Можно выбрать до 5 аргументов" : argument.name}
              >
                {argument.name}
                {selectedAlready ? " · выбран" : ""}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function getSelectedSetupNames(item: SessionPlan, tradeArguments: TradeArgument[]) {
  return getTradeArgumentNames(tradeArguments, item.argumentIds, getPlanArgumentNames(item));
}
