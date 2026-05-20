import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Rule, SectionTitle } from "./form-controls";
import { formatCurrency } from "./utils";
import type { PermissionToTrade } from "./types";

const permissionLabels: Record<PermissionToTrade["permission"], string> = {
  granted: "РАЗРЕШЕНО",
  reduced: "СНИЖЕННЫЙ РИСК",
  denied: "ЗАПРЕЩЕНО",
};

export function PermissionCard({ permission }: { permission: PermissionToTrade }) {
  return (
    <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<BadgeCheck className="h-4 w-4" />} title="Финальное разрешение" />
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Rule title="Разрешение" value={permissionLabels[permission.permission]} />
          <Rule title="Макс. риск на сделку" value={formatCurrency(permission.maxAllowedRisk)} />
          <Rule title="Ещё сделок сегодня" value={String(permission.maxAdditionalTrades)} />
          <Rule title="Повторный вход" value={permission.reEntryAllowed ? "Разрешён" : "Запрещён"} />
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-200">{permission.instruction}</div>
      </CardContent>
    </Card>
  );
}
