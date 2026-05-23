import { ENTRY_METHOD_OPTIONS } from "./constants";
import { SelectInput } from "./form-controls";
import { getPlanEntryMethod } from "./utils";
import type { EditablePlanField, SessionPlan } from "./types";

type EntryMethodSelectorProps = {
  item: SessionPlan;
  onUpdate: <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => void;
};

export function EntryMethodSelector({ item, onUpdate }: EntryMethodSelectorProps) {
  const entryMethod = getPlanEntryMethod(item);

  return (
    <div className="mb-4 max-w-md">
      <SelectInput
        label="Способ входа"
        value={entryMethod}
        setValue={(value) => onUpdate(item.id, "entryMethod", value)}
        options={ENTRY_METHOD_OPTIONS}
      />
      {!entryMethod && <div className="mt-2 text-xs text-amber-100">Не выбран способ входа.</div>}
    </div>
  );
}
