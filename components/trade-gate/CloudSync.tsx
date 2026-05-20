import { Button } from "@/components/ui/button";
import { formatSyncStatus } from "@/components/trade-gate/utils";

export function CloudSync({
  syncKey,
  syncStatus,
  onSyncKeyChange,
  onLoad,
  onSave,
}: {
  syncKey: string;
  syncStatus: string;
  onSyncKeyChange: (value: string) => void;
  onLoad: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">Синхронизация</div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          value={syncKey}
          onChange={(event) => onSyncKeyChange(event.target.value)}
          placeholder="Ключ синхронизации, например nataliia-main"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
        />
        <Button onClick={onLoad} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
          Загрузить из облака
        </Button>
        <Button onClick={onSave} variant="outline" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
          Сохранить сейчас
        </Button>
      </div>
      {syncStatus && <div className="mt-2 text-sm text-neutral-400">{formatSyncStatus(syncStatus)}</div>}
    </div>
  );
}
