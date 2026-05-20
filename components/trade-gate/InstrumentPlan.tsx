import { Plus } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScenarioCard } from "./ScenarioCard";
import { getInstrumentImageKey, getMarketIdeaKey } from "./utils";
import type { EditablePlanField, MarketIdea, MarketIdeaField, MarketIdeaNotes, PersistedImages, SessionPlan, Setup } from "./types";

export function InstrumentPlan({
  idea,
  activePlanDate,
  plans,
  setups,
  instrumentImages,
  marketIdeaNotes,
  onAddScenario,
  onUpdateIdeaText,
  onImageChange,
  onUpdatePlan,
  onArchivePlan,
  onRemovePlan,
}: {
  idea: MarketIdea;
  activePlanDate: string;
  plans: SessionPlan[];
  setups: Setup[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  onAddScenario: (symbol: string) => void;
  onUpdateIdeaText: (symbol: string, field: MarketIdeaField, value: string) => void;
  onImageChange: (symbol: string, file: File | undefined) => void;
  onUpdatePlan: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
  onArchivePlan: (id: number) => void;
  onRemovePlan: (id: number) => void;
}) {
  const imageKey = getInstrumentImageKey(activePlanDate, idea.symbol);
  const image = instrumentImages[imageKey];
  const getIdeaText = (field: MarketIdeaField) => marketIdeaNotes[getMarketIdeaKey(activePlanDate, idea.symbol, field)] ?? idea[field];

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
            <div className="mb-1 text-xs uppercase tracking-[0.2em] text-neutral-500">Идея / bias</div>
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
            <Image src={image} alt={`chart ${idea.symbol}`} width={260} height={144} unoptimized className="h-36 w-full rounded-xl object-cover" />
          ) : (
            <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-neutral-600">
              Прикрепи скрин графика
              <br />
              для этого инструмента
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onImageChange(idea.symbol, event.target.files?.[0])}
            className="mt-3 w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-neutral-100"
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
              setups={setups}
              onUpdate={onUpdatePlan}
              onArchive={onArchivePlan}
              onRemove={onRemovePlan}
            />
          ))
        )}
      </div>
    </div>
  );
}
