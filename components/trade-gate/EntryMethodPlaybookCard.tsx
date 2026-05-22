import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle, TextInput, Toggle } from "./form-controls";
import type { EntryMethod } from "./types";

export function EntryMethodPlaybookCard({
  entryMethods,
  onAdd,
  onUpdate,
  onDelete,
}: {
  entryMethods: EntryMethod[];
  onAdd: (name: string, description: string) => void;
  onUpdate: (id: string, changes: Partial<Pick<EntryMethod, "name" | "description" | "isActive">>) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const addEntryMethod = () => {
    if (!newName.trim()) return;
    onAdd(newName, newDescription);
    setNewName("");
    setNewDescription("");
  };

  return (
    <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<CornerDownRight className="h-4 w-4" />} title="Плейбук способов входа" />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <TextInput label="Новый способ входа" value={newName} setValue={setNewName} />
            <TextInput label="Описание" value={newDescription} setValue={setNewDescription} />
            <div className="flex items-end">
              <Button onClick={addEntryMethod} variant="outline" className="w-full rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1]">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {entryMethods.map((method) => (
            <div key={method.id} className={`rounded-2xl border p-4 ${method.isActive ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.05] bg-black/10 opacity-70"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-100">{method.name || "Без названия"}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {method.isDefault ? "Предустановленный способ" : "Пользовательский способ"} · {method.isActive ? "активен" : "скрыт"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onUpdate(method.id, { isActive: !method.isActive })}
                    variant="outline"
                    className="rounded-xl border border-white/[0.08] bg-black/20 text-neutral-100 hover:bg-white/[0.06]"
                  >
                    {method.isActive ? "Скрыть" : "Показать"}
                  </Button>
                  {!method.isDefault && (
                    <Button onClick={() => onDelete(method.id)} variant="outline" className="rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <TextInput label="Название" value={method.name} setValue={(value) => onUpdate(method.id, { name: value })} />
                <TextInput label="Описание" value={method.description ?? ""} setValue={(value) => onUpdate(method.id, { description: value })} />
              </div>
              <div className="mt-3 max-w-xs">
                <Toggle label="Активен в списке сценариев" value={method.isActive} setValue={(value) => onUpdate(method.id, { isActive: value })} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
