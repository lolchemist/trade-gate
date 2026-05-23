import { Plus, RadioTower, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioCard } from "./ScenarioCard";
import { getInstrumentImageKey, getMarketIdeaKey, isPlanReady, isScenarioPlannedExposure } from "./utils";
import { MetricTile, ProgressMeter, StatusPill, TerminalPanel } from "./terminal-ui";
import type { CarryScenarioMode, EditablePlanField, EditableTradeField, MarketIdea, MarketIdeaField, MarketIdeaNotes, PersistedImages, ScenarioTrade, SessionPlan, TradeArgument, TradeExecutionType } from "./types";

const instrumentAccents: Record<string, { title: string; tone: "emerald" | "amber" | "cyan"; gradient: string }> = {
  "UKOIL.cash": { title: "Энергия", tone: "emerald", gradient: "from-emerald-200/[0.09] via-transparent to-sky-100/[0.05]" },
  XAUUSD: { title: "Металлы", tone: "amber", gradient: "from-amber-100/[0.09] via-transparent to-stone-100/[0.045]" },
  "COCOA.c": { title: "Сырьё", tone: "cyan", gradient: "from-sky-100/[0.07] via-transparent to-emerald-100/[0.045]" },
};

export function InstrumentCard({
  idea,
  activePlanDate,
  plans,
  tradeArguments,
  instrumentImages,
  marketIdeaNotes,
  onAddScenario,
  onUpdateIdeaText,
  onImageChange,
  onDeleteImage,
  onUpdatePlan,
  onAddTrade,
  onUpdateTrade,
  onRemoveTrade,
  onClosePlan,
  onReopenPlan,
  onCarryPlan,
  onRemovePlan,
}: {
  idea: MarketIdea;
  activePlanDate: string;
  plans: SessionPlan[];
  tradeArguments: TradeArgument[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  onAddScenario: (symbol: string) => void;
  onUpdateIdeaText: (symbol: string, field: MarketIdeaField, value: string) => void;
  onImageChange: (symbol: string, file: File | undefined) => void;
  onDeleteImage: (symbol: string) => void;
  onUpdatePlan: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onAddTrade: (scenarioId: number, executionType: TradeExecutionType) => void;
  onUpdateTrade: <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => void;
  onRemoveTrade: (scenarioId: number, tradeId: string) => void;
  onClosePlan: (id: number) => void;
  onReopenPlan: (id: number) => void;
  onCarryPlan: (id: number, mode: CarryScenarioMode) => void;
  onRemovePlan: (id: number) => void;
}) {
  const accent = instrumentAccents[idea.symbol] ?? instrumentAccents["UKOIL.cash"];
  const imageKey = getInstrumentImageKey(activePlanDate, idea.symbol);
  const uploadInputId = `chart-upload-${imageKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const image = instrumentImages[imageKey];
  const readyCount = plans.filter(isPlanReady).length;
  const riskAllocated = plans.filter(isScenarioPlannedExposure).reduce((sum, plan) => sum + (Number(plan.tradeRisk) || 0), 0);
  const readiness = plans.length > 0 ? Math.round((readyCount / plans.length) * 100) : 0;
  const getIdeaText = (field: MarketIdeaField) => marketIdeaNotes[getMarketIdeaKey(activePlanDate, idea.symbol, field)] ?? idea[field];

  if (process.env.NODE_ENV !== "production") {
    console.debug("[TradeGate chart render]", { symbol: idea.symbol, previewKey: imageKey, hasImage: Boolean(image) });
  }

  return (
    <TerminalPanel className="overflow-hidden" glow={accent.tone}>
      <div className={`relative bg-gradient-to-br ${accent.gradient} p-5`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={accent.tone}>{accent.title}</StatusPill>
                  <StatusPill>{idea.symbol}</StatusPill>
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-100">{idea.title}</div>
              </div>
              <Button onClick={() => onAddScenario(idea.symbol)} variant="outline" className="h-11 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-4 text-emerald-100 hover:bg-emerald-200/[0.1]">
                <Plus className="mr-2 h-4 w-4" />
                Сценарий
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Сценарии" value={String(plans.length)} />
              <MetricTile label="Готовы" value={`${readyCount}/${plans.length || 0}`} tone={readyCount > 0 ? "emerald" : "amber"} />
              <MetricTile label="Риск" value={`$${riskAllocated.toFixed(0)}`} tone={riskAllocated > 0 ? "amber" : "neutral"} />
            </div>
            <div className="mt-5">
              <ProgressMeter label="Готовность инструмента" value={readiness} tone={readiness >= 70 ? "emerald" : "amber"} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <MarketText label="Идея / направление" value={getIdeaText("bias")} onChange={(value) => onUpdateIdeaText(idea.symbol, "bias", value)} />
              <MarketText label="Альтернативный сценарий / отмена" value={getIdeaText("scenario")} onChange={(value) => onUpdateIdeaText(idea.symbol, "scenario", value)} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-3 shadow-inner shadow-black/20">
            <div className="mb-3 flex items-center justify-between text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              <span>График</span>
              <RadioTower className="h-4 w-4" />
            </div>
            {image ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={`preview:${imageKey}`} src={image} alt={`chart ${idea.symbol}`} className="h-48 w-full rounded-2xl object-cover shadow-xl shadow-black/25" />
                <Button
                  type="button"
                  onClick={() => onDeleteImage(idea.symbol)}
                  variant="outline"
                  className="w-full rounded-2xl border border-rose-200/20 bg-rose-200/[0.06] px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 hover:bg-rose-200/[0.1]"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить график
                </Button>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/20 text-center text-xs uppercase tracking-[0.18em] text-neutral-600">
                Скрин графика
                <br />
                для даты / инструмента
              </div>
            )}
            <label htmlFor={uploadInputId} className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300 transition hover:bg-white/10">
              <Upload className="h-4 w-4" />
              Загрузить график
            </label>
            <input
              key={`upload:${imageKey}`}
              id={uploadInputId}
              type="file"
              accept="image/*"
              aria-label={`Загрузить график ${idea.symbol}`}
              data-instrument-symbol={idea.symbol}
              data-image-key={imageKey}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                onImageChange(idea.symbol, file);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5 pt-0">
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-neutral-500">
            Нет сценариев по этому инструменту на выбранную дату.
          </div>
        ) : (
          plans.map((item, index) => (
            <ScenarioCard
              key={item.id}
              item={item}
              index={index}
              tradeArguments={tradeArguments}
              hasChartImage={Boolean(image)}
              onUpdate={onUpdatePlan}
              onAddTrade={onAddTrade}
              onUpdateTrade={onUpdateTrade}
              onRemoveTrade={onRemoveTrade}
              onClose={onClosePlan}
              onReopen={onReopenPlan}
              onCarry={onCarryPlan}
              onRemove={onRemovePlan}
            />
          ))
        )}
      </div>
    </TerminalPanel>
  );
}

function MarketText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}
