import { Activity, BarChart3, Brain, Gauge, LineChart, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrency, formatPlanDate } from "./utils";
import { MetricTile, PanelHeader, ProgressMeter, StatusPill, TerminalPanel } from "./terminal-ui";
import type { AnalyticsGroup, AnalyticsInsight, AnalyticsReport, AnalyticsTone } from "@/hooks/trade-gate/useAnalytics";

export function AnalyticsDashboard({ analytics }: { analytics: AnalyticsReport }) {
  const { overview } = analytics;

  return (
    <div className="space-y-5">
      <TerminalPanel className="overflow-hidden" glow={overview.netPnl >= 0 ? "emerald" : "red"}>
        <div className="relative bg-gradient-to-br from-emerald-100/[0.08] via-white/[0.035] to-black/10 p-5 md:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-100/25 to-transparent" />
          <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={analytics.hasEnoughData ? "emerald" : "amber"}>{analytics.hasEnoughData ? "Insight layer" : "Нужно больше данных"}</StatusPill>
                <StatusPill tone="neutral">{overview.tradeCount} исполнений</StatusPill>
              </div>
              <div className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-neutral-500">Поведенческая аналитика</div>
              <div className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-neutral-50 md:text-5xl">
                Что даёт edge, а что ломает результат
              </div>
              <div className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-400">
                Аналитика строится из архивных сценариев и фактических исполнений: плановый RR, качество сценария, качество исполнения, результат и поведенческий контекст.
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InsightList title="Что работает" items={analytics.insightSummary.positives} tone="emerald" />
                <InsightList title="Что опасно" items={analytics.insightSummary.warnings} tone="amber" />
                <InsightList title="Фокус" items={[analytics.insightSummary.focus]} tone="cyan" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Net PnL" value={formatCurrency(overview.netPnl)} tone={overview.netPnl >= 0 ? "emerald" : "red"} />
              <MetricTile label="Сделок" value={String(overview.tradeCount)} detail={`${overview.scenarioCount} сценариев`} />
              <MetricTile label="Техничность" value={`${overview.technicalPercentage}%`} tone={overview.technicalPercentage >= 70 ? "emerald" : "amber"} />
              <MetricTile label="Дисциплина" value={`${overview.disciplineScore}%`} tone={overview.disciplineScore >= 70 ? "emerald" : "amber"} />
              <MetricTile label="План RR" value={overview.averagePlannedRr > 0 ? `1:${overview.averagePlannedRr.toFixed(2)}` : "—"} />
              <MetricTile label="Факт RR" value={overview.averageActualRr !== 0 ? overview.averageActualRr.toFixed(2) : "—"} />
              <MetricTile label="Качество исполнения" value={`${overview.averageExecutionQuality}%`} tone={overview.averageExecutionQuality >= 70 ? "emerald" : "amber"} />
              <MetricTile label="Revenge риск" value={`${overview.averageRevengeRisk}%`} tone={overview.averageRevengeRisk > 0 ? "red" : "neutral"} />
            </div>
          </div>
        </div>
      </TerminalPanel>

      {!analytics.hasEnoughData && (
        <TerminalPanel className="p-5" glow="amber">
          <PanelHeader eyebrow="Надёжность выводов" title="Недостаточно данных для устойчивого expectancy" meta={<Gauge className="h-5 w-5 text-amber-100" />} />
          <div className="mt-4 text-sm leading-relaxed text-neutral-400">
            Нужно минимум 10 исполненных сделок в архиве. Сейчас: {overview.tradeCount}. Карточки ниже уже считают факты, но выводы стоит воспринимать как ранние сигналы, не как статистический закон.
          </div>
        </TerminalPanel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <InsightSection
          eyebrow="Edge discovery"
          title="Что работает"
          icon={<TrendingUp className="h-5 w-5 text-emerald-100" />}
          insights={analytics.whatWorks}
          empty="Пока нет положительных паттернов. Закрой несколько торговых дней, чтобы увидеть рабочие связки."
        />
        <InsightSection
          eyebrow="Performance killers"
          title="Что ломает результат"
          icon={<TrendingDown className="h-5 w-5 text-rose-100" />}
          insights={analytics.whatHurts}
          empty="Пока нет выраженных разрушителей результата. Продолжай фиксировать исполнения и причины."
        />
      </div>

      <TerminalPanel className="p-5" glow="cyan">
        <PanelHeader eyebrow="Execution quality" title="Хороший результат ≠ хорошее исполнение" meta={<ShieldCheck className="h-5 w-5 text-neutral-500" />} />
        <div className="mt-2 text-sm text-neutral-500">Стоп может быть хорошей сделкой, если план исполнен технично и риск не нарушен.</div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricTile label="PnL техничных" value={formatCurrency(analytics.execution.technicalPnl)} tone={analytics.execution.technicalPnl >= 0 ? "emerald" : "red"} />
          <MetricTile label="PnL нетехничных" value={formatCurrency(analytics.execution.nonTechnicalPnl)} tone={analytics.execution.nonTechnicalPnl >= 0 ? "emerald" : "red"} />
          <MetricTile label="Отклонение риска" value={`${analytics.execution.averageRiskDeviation.toFixed(1)}%`} tone={Math.abs(analytics.execution.averageRiskDeviation) <= 5 ? "emerald" : "amber"} />
          <MetricTile label="План vs факт RR" value={analytics.execution.plannedVsActualRrDeviation.toFixed(2)} tone={analytics.execution.plannedVsActualRrDeviation >= 0 ? "emerald" : "amber"} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <RankedGroupList title="Качество исполнения" groups={analytics.groups.byExecutionQuality} />
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Нарушения плана</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Ручных закрытий" value={String(analytics.execution.manualCloseCount)} tone={analytics.execution.manualCloseCount > 0 ? "amber" : "neutral"} />
              <MetricTile label="Слабых исполнений" value={String(analytics.execution.planViolationCount)} tone={analytics.execution.planViolationCount > 0 ? "red" : "emerald"} />
              <MetricTile label="Частично техничные" value={formatCurrency(analytics.execution.partialTechnicalPnl)} />
              <MetricTile label="Среднее качество" value={`${overview.averageExecutionQuality}%`} tone={overview.averageExecutionQuality >= 70 ? "emerald" : "amber"} />
            </div>
          </div>
        </div>
      </TerminalPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <TerminalPanel className="p-5" glow="amber">
          <PanelHeader eyebrow="Behavioral analysis" title="Поведение и эмоциональный контекст" meta={<Brain className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricTile label="Revenge частота" value={`${analytics.behavior.revengeFrequency}%`} tone={analytics.behavior.revengeFrequency > 0 ? "red" : "neutral"} />
            <MetricTile label="PnL revenge-дней" value={formatCurrency(analytics.behavior.revengePnl)} tone={analytics.behavior.revengePnl >= 0 ? "emerald" : "red"} />
            <MetricTile label="После стопа" value={formatCurrency(analytics.behavior.stopStreakLoss)} tone={analytics.behavior.stopStreakLoss >= 0 ? "emerald" : "red"} />
          </div>
          <div className="mt-5 grid gap-4">
            <BucketList title="Тревога vs результат" groups={analytics.behavior.anxietyBuckets} empty="Нет данных по тревоге для архивных сделок." />
            <BucketList title="Желание войти vs результат" groups={analytics.behavior.urgeBuckets} empty="Нет данных по импульсу входа." />
            <BucketList title="Злость vs результат" groups={analytics.behavior.angerBuckets} empty="Нет данных по злости." />
          </div>
        </TerminalPanel>

        <TerminalPanel className="p-5" glow="emerald">
          <PanelHeader eyebrow="Risk discipline" title="Риск-дисциплина" meta={<Gauge className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricTile label="Средний риск" value={formatCurrency(analytics.risk.averageRiskPerTrade)} />
            <MetricTile label="Макс. отклонение" value={`${analytics.risk.biggestRiskDeviation.toFixed(1)}%`} tone={analytics.risk.biggestRiskDeviation > 10 ? "amber" : "emerald"} />
            <MetricTile label="Дни сверх бюджета" value={String(analytics.risk.riskBudgetExceededDays)} tone={analytics.risk.riskBudgetExceededDays > 0 ? "red" : "emerald"} />
            <MetricTile label="Личный стоп hit" value={String(analytics.risk.personalDailyStopHits)} tone={analytics.risk.personalDailyStopHits > 0 ? "red" : "neutral"} />
            <MetricTile label="PnL дисциплины" value={formatCurrency(analytics.risk.disciplinedDayPnl)} tone={analytics.risk.disciplinedDayPnl >= 0 ? "emerald" : "red"} />
            <MetricTile label="PnL нарушений" value={formatCurrency(analytics.risk.violatedDayPnl)} tone={analytics.risk.violatedDayPnl >= 0 ? "emerald" : "red"} />
          </div>
        </TerminalPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TerminalPanel className="p-5" glow="cyan">
          <PanelHeader eyebrow="Entry type analytics" title="Способы входа" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-3">
            {analytics.groups.byEntryMethod.length === 0 ? (
              <EmptyState text="Нет архивных исполнений со способом входа." />
            ) : (
              analytics.groups.byEntryMethod.map((group) => <PerformanceRow key={group.label} group={group} />)
            )}
          </div>
        </TerminalPanel>

        <TerminalPanel className="p-5" glow="emerald">
          <PanelHeader eyebrow="Instrument analytics" title="Инструменты" meta={<LineChart className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-3">
            {analytics.groups.byInstrument.length === 0 ? (
              <EmptyState text="Нет архивных исполнений по инструментам." />
            ) : (
              analytics.groups.byInstrument.map((group) => <InstrumentRow key={group.label} group={group} entryGroups={analytics.groups.byEntryMethod} />)
            )}
          </div>
        </TerminalPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TerminalPanel className="p-5" glow="amber">
          <PanelHeader eyebrow="Scenario quality" title="Качество сценариев" meta={<BarChart3 className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-4">
            {analytics.groups.byScenarioQuality.map((group) => (
              <QualityBucket key={group.label} group={group} />
            ))}
            {analytics.groups.byScenarioQuality.length === 0 && <EmptyState text="Нет архивных сценариев с исполнениями." />}
          </div>
        </TerminalPanel>

        <TerminalPanel className="p-5" glow="neutral">
          <PanelHeader eyebrow="RR profile" title="Плановый RR и аргументы сценария" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
          <div className="mt-5 grid gap-4">
            <RankedGroupList title="RR-бакеты" groups={analytics.groups.byPlannedRr} />
            <RankedGroupList title="Аргументы сценария" groups={analytics.groups.byScenarioArgument.slice(0, 6)} />
            <RankedGroupList title="Связки аргументов" groups={analytics.groups.byArgumentCombination.slice(0, 6)} />
          </div>
        </TerminalPanel>
      </div>

      <TerminalPanel className="p-5" glow={analytics.weekly.netPnl >= 0 ? "emerald" : "red"}>
        <PanelHeader
          eyebrow="Weekly report"
          title={`${formatPlanDate(analytics.weekly.weekStart)} — ${formatPlanDate(analytics.weekly.weekEnd)}`}
          meta={<BarChart3 className="h-5 w-5 text-neutral-500" />}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricTile label="Net PnL" value={formatCurrency(analytics.weekly.netPnl)} tone={analytics.weekly.netPnl >= 0 ? "emerald" : "red"} />
          <MetricTile label="Сделок" value={String(analytics.weekly.trades)} detail={`${analytics.weekly.scenarios} сценариев`} />
          <MetricTile label="Техничность" value={`${analytics.weekly.technicalPercentage}%`} tone={analytics.weekly.technicalPercentage >= 70 ? "emerald" : "amber"} />
          <MetricTile label="Лучший вход" value={analytics.weekly.bestEntryMethod} tone="emerald" />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <WeeklyNote title="Что повторить" text={analytics.weekly.repeatNextWeek} tone="emerald" />
          <WeeklyNote title="Что избегать" text={analytics.weekly.avoidNextWeek} tone="amber" />
          <WeeklyNote title="Самая дорогая ошибка" text={analytics.weekly.biggestMistake} tone="red" />
          <WeeklyNote title="Лучшее поведение" text={analytics.weekly.bestBehavior} tone="cyan" />
        </div>
      </TerminalPanel>
    </div>
  );
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: AnalyticsTone }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className={`text-sm leading-relaxed ${toneText(tone)}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightSection({ eyebrow, title, icon, insights, empty }: { eyebrow: string; title: string; icon: ReactNode; insights: AnalyticsInsight[]; empty: string }) {
  return (
    <TerminalPanel className="p-5" glow={title.includes("ломает") ? "red" : "emerald"}>
      <PanelHeader eyebrow={eyebrow} title={title} meta={icon} />
      <div className="mt-5 grid gap-3">
        {insights.length === 0 ? <EmptyState text={empty} /> : insights.map((insight) => <InsightCard key={`${insight.title}-${insight.value}`} insight={insight} />)}
      </div>
    </TerminalPanel>
  );
}

function InsightCard({ insight }: { insight: AnalyticsInsight }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">{insight.title}</div>
          <div className={`mt-2 text-xl font-semibold ${toneText(insight.tone)}`}>{insight.value}</div>
        </div>
        <StatusPill tone={insight.tone}>{insight.tone === "red" ? "risk" : "signal"}</StatusPill>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-neutral-500">{insight.detail}</div>
    </div>
  );
}

function PerformanceRow({ group }: { group: AnalyticsGroup }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-neutral-100">{group.label}</div>
          <div className="mt-1 text-xs text-neutral-500">{group.tradeCount} сделок · Winrate {group.winrate}% · Expectancy {formatCurrency(group.expectancy)}</div>
        </div>
        <div className={`font-mono text-sm font-semibold ${group.pnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(group.pnl)}</div>
      </div>
      <ProgressMeter label="Техничность" value={group.technicalPercentage} detail={`${group.technicalPercentage}% · Avg RR ${group.averageActualRr.toFixed(2)}`} tone={group.technicalPercentage >= 70 ? "emerald" : "amber"} />
    </div>
  );
}

function InstrumentRow({ group }: { group: AnalyticsGroup; entryGroups: AnalyticsGroup[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-neutral-100">{group.label}</div>
          <div className="mt-1 text-xs text-neutral-500">{group.tradeCount} сделок · средний риск {formatCurrency(group.averageRisk)}</div>
        </div>
        <div className={`font-mono text-sm font-semibold ${group.pnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(group.pnl)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Техничность" value={`${group.technicalPercentage}%`} />
        <MiniMetric label="Avg RR" value={group.averageActualRr.toFixed(2)} />
        <MiniMetric label="Expectancy" value={formatCurrency(group.expectancy)} />
      </div>
    </div>
  );
}

function QualityBucket({ group }: { group: AnalyticsGroup }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-medium text-neutral-100">{group.label}</div>
        <div className={`font-mono text-sm ${group.pnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(group.pnl)}</div>
      </div>
      <ProgressMeter label={`${group.tradeCount} сделок`} value={group.technicalPercentage} detail={`${group.technicalPercentage}% техничность · RR ${group.averageActualRr.toFixed(2)}`} tone={group.pnl >= 0 ? "emerald" : "amber"} />
    </div>
  );
}

function RankedGroupList({ title, groups }: { title: string; groups: AnalyticsGroup[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      {groups.length === 0 ? (
        <EmptyState text="Недостаточно данных." />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-neutral-100">{group.label}</div>
                <div className="text-xs text-neutral-500">{group.tradeCount} сделок · {group.technicalPercentage}% тех.</div>
              </div>
              <div className={`shrink-0 font-mono text-sm ${group.pnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(group.pnl)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BucketList({ title, groups, empty }: { title: string; groups: AnalyticsGroup[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      {groups.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <div className="grid gap-2">
          {groups.map((group) => (
            <PerformanceRow key={group.label} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyNote({ title, text, tone }: { title: string; text: string; tone: AnalyticsTone }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className={`mt-2 text-sm leading-relaxed ${toneText(tone)}`}>{text}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-100">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-neutral-500">{text}</div>;
}

function toneText(tone: AnalyticsTone) {
  if (tone === "emerald") return "text-emerald-100";
  if (tone === "amber") return "text-amber-100";
  if (tone === "red") return "text-rose-100";
  if (tone === "cyan") return "text-sky-100";
  return "text-neutral-200";
}
