import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle, TextInput, Toggle } from "./form-controls";
import type { Setup } from "./types";

export function SetupPlaybookCard({
  setups,
  onAdd,
  onUpdate,
  onDelete,
}: {
  setups: Setup[];
  onAdd: (name: string, description: string, defaultInstrument: string) => void;
  onUpdate: (id: string, changes: Partial<Pick<Setup, "name" | "description" | "defaultInstrument" | "isActive">>) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDefaultInstrument, setNewDefaultInstrument] = useState("");

  const addSetup = () => {
    if (!newName.trim()) return;
    onAdd(newName, newDescription, newDefaultInstrument);
    setNewName("");
    setNewDescription("");
    setNewDefaultInstrument("");
  };

  return (
    <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="Плейбук сетапов" />

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <TextInput label="Новый сетап" value={newName} setValue={setNewName} />
            <TextInput label="Описание" value={newDescription} setValue={setNewDescription} />
            <TextInput label="Инструмент по умолчанию" value={newDefaultInstrument} setValue={(value) => setNewDefaultInstrument(value.toUpperCase())} />
            <div className="flex items-end">
              <Button onClick={addSetup} variant="outline" className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {setups.map((setup) => (
            <div key={setup.id} className={`rounded-2xl border p-4 ${setup.isActive ? "border-white/10 bg-black/25" : "border-white/5 bg-black/10 opacity-70"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-100">{setup.name || "Без названия"}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {setup.isDefault ? "Предустановленный сетап" : "Пользовательский сетап"} · {setup.isActive ? "активен" : "скрыт"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onUpdate(setup.id, { isActive: !setup.isActive })}
                    variant="outline"
                    className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                  >
                    {setup.isActive ? "Скрыть" : "Показать"}
                  </Button>
                  {!setup.isDefault && (
                    <Button onClick={() => onDelete(setup.id)} variant="outline" className="rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <TextInput label="Название" value={setup.name} setValue={(value) => onUpdate(setup.id, { name: value })} />
                <TextInput label="Описание" value={setup.description ?? ""} setValue={(value) => onUpdate(setup.id, { description: value })} />
                <TextInput
                  label="Инструмент по умолчанию"
                  value={setup.defaultInstrument ?? ""}
                  setValue={(value) => onUpdate(setup.id, { defaultInstrument: value.toUpperCase() })}
                />
              </div>
              <div className="mt-3 max-w-xs">
                <Toggle label="Активен в списке сценариев" value={setup.isActive} setValue={(value) => onUpdate(setup.id, { isActive: value })} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
