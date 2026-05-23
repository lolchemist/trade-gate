import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle, TextInput } from "./form-controls";
import type { TradeArgument } from "./types";

export function TradeArgumentLibraryCard({
  tradeArguments,
  onAdd,
  onUpdate,
  onDelete,
}: {
  tradeArguments: TradeArgument[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const existingNames = new Set(tradeArguments.map((argument) => argument.name.trim().toLowerCase()).filter(Boolean));
  const newNameTrimmed = newName.trim();
  const addDisabled = !newNameTrimmed || existingNames.has(newNameTrimmed.toLowerCase());

  const addArgument = () => {
    if (addDisabled) return;
    onAdd(newNameTrimmed);
    setNewName("");
  };

  return (
    <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="Торговые аргументы" />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <TextInput label="Новый аргумент" value={newName} setValue={setNewName} />
            <div className="flex items-end">
              <Button
                onClick={addArgument}
                disabled={addDisabled}
                variant="outline"
                className="w-full rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
          </div>
          {newNameTrimmed && existingNames.has(newNameTrimmed.toLowerCase()) && <div className="mt-2 text-xs text-amber-100">Такой аргумент уже есть.</div>}
        </div>

        <div className="space-y-3">
          {tradeArguments.map((argument) => (
            <div key={argument.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <TextInput label="Название" value={argument.name} setValue={(value) => onUpdate(argument.id, value)} />
                <div className="flex items-end">
                  <Button onClick={() => onDelete(argument.id)} variant="outline" className="rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
