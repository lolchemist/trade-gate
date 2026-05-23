import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeScenarioArguments } from "./utils";
import { StatusPill } from "./terminal-ui";
import type { EditablePlanField, SessionPlan } from "./types";

type ArgumentSelectorProps = {
  item: SessionPlan;
  availableArguments: string[];
  selectedArguments: string[];
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
};

export function ArgumentSelector({ item, availableArguments, selectedArguments, onUpdate }: ArgumentSelectorProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selectedArguments.map((argument) => argument.toLowerCase()));
  const exactMatch = availableArguments.find((argument) => argument.trim().toLowerCase() === normalizedQuery);
  const quickArguments = normalizeScenarioArguments(availableArguments).filter((argument) => {
    if (selectedSet.has(argument.toLowerCase())) return false;
    return normalizedQuery ? argument.toLowerCase().includes(normalizedQuery) : true;
  });

  const updateArguments = (nextArguments: string[]) => {
    onUpdate(item.id, "arguments", normalizeScenarioArguments(nextArguments));
  };

  const addArgument = (argument: string) => {
    const value = argument.trim();
    if (!value || selectedSet.has(value.toLowerCase())) return;
    updateArguments([...selectedArguments, value]);
    setQuery("");
  };

  const removeArgument = (argument: string) => {
    updateArguments(selectedArguments.filter((itemArgument) => itemArgument !== argument));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Аргументы сценария</div>
        <StatusPill tone={selectedArguments.length >= 2 ? "emerald" : "amber"}>{selectedArguments.length}/2 минимум</StatusPill>
      </div>
      <div className="flex min-h-9 flex-wrap gap-2">
        {selectedArguments.length === 0 ? (
          <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-xs text-amber-100">Аргументы не добавлены</span>
        ) : (
          selectedArguments.map((argument) => (
            <span key={argument} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-xs text-emerald-100">
              {argument}
              <button type="button" onClick={() => removeArgument(argument)} className="rounded-full text-emerald-100/70 transition hover:text-emerald-50" aria-label={`Убрать аргумент ${argument}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти аргумент из списка"
          className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
        />
        <Button
          type="button"
          onClick={() => exactMatch && addArgument(exactMatch)}
          disabled={!exactMatch || selectedSet.has(exactMatch.toLowerCase())}
          variant="outline"
          className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </div>
      {selectedArguments.length === 0 && <div className="mt-2 text-xs text-amber-100">Добавь минимум 2 аргумента.</div>}
      {selectedArguments.length === 1 && <div className="mt-2 text-xs text-amber-100">Недостаточно аргументов для сценария. Минимум 2 аргумента required.</div>}
      {query.trim() && !exactMatch && <div className="mt-2 text-xs text-neutral-500">Новый аргумент сначала добавляется в настройках.</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {quickArguments.map((argument) => (
          <button
            key={argument}
            type="button"
            onClick={() => addArgument(argument)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-200/20 hover:bg-emerald-200/[0.07] hover:text-emerald-100"
          >
            {argument}
          </button>
        ))}
      </div>
    </div>
  );
}
