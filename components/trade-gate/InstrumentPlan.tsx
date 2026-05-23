import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioCard } from "./ScenarioCard";
import { getInstrumentImageKey, getMarketIdeaKey } from "./utils";
import type { CarryScenarioMode, EditablePlanField, EditableTradeField, EntryMethod, MarketIdea, MarketIdeaField, MarketIdeaNotes, PersistedImages, ScenarioTrade, SessionPlan, TradeArgument, TradeExecutionType } from "./types";

export function InstrumentPlan({
  idea,
  activePlanDate,
  plans,
  tradeArguments,
  entryMethods,
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
  entryMethods: EntryMethod[];
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
  const imageKey = getInstrumentImageKey(activePlanDate, idea.symbol);
  const uploadInputId = `chart-upload-${imageKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const image = instrumentImages[imageKey];
  const getIdeaText = (field: MarketIdeaField) => marketIdeaNotes[getMarketIdeaKey(activePlanDate, idea.symbol, field)] ?? idea[field];

  if (process.env.NODE_ENV !== "production") {
    console.debug("[TradeGate chart render]", { symbol: idea.symbol, previewKey: imageKey, hasImage: Boolean(image) });
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/20 p-4 shadow-xl">
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{idea.symbol}</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-100">{idea.title}</div>
            </div>
            <Button onClick={() => onAddScenario(idea.symbol)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
              <Plus className="mr-2 h-4 w-4" />
              Сценарий
            </Button>
          </div>

          <label className="mt-4 block">
            <div className="mb-1 text-xs uppercase tracking-[0.2em] text-neutral-500">Идея / направление</div>
            <textarea
              value={getIdeaText("bias")}
              onChange={(event) => onUpdateIdeaText(idea.symbol, "bias", event.target.value)}
              className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
            />
          </label>

          <label className="mt-3 block">
            <div className="mb-1 text-xs uppercase tracking-[0.2em] text-neutral-500">Альтернативный сценарий / отмена</div>
            <textarea
              value={getIdeaText("scenario")}
              onChange={(event) => onUpdateIdeaText(idea.symbol, "scenario", event.target.value)}
              className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-500 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-500">Картинка / график</div>
          {image ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={`preview:${imageKey}`} src={image} alt={`chart ${idea.symbol}`} className="h-36 w-full rounded-xl object-cover" />
              <Button onClick={() => onDeleteImage(idea.symbol)} variant="outline" className="w-full rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-xs text-rose-100 hover:bg-rose-200/[0.1]">
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить график
              </Button>
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-neutral-600">
              Прикрепи скрин графика
              <br />
              для этого инструмента
            </div>
          )}
          <label htmlFor={uploadInputId} className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
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
            className="mt-2 w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-neutral-100"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-500">
            Пока нет сценариев по этому инструменту на выбранную дату. Добавь сценарий только здесь, внутри нужного инструмента.
          </div>
        ) : (
          plans.map((item, index) => (
            <ScenarioCard
              key={item.id}
              item={item}
              index={index}
              tradeArguments={tradeArguments}
              entryMethods={entryMethods}
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
    </div>
  );
}
