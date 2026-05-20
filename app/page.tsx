"use client";
// @ts-nocheck
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Lock, Shield, Timer, TrendingUp, Calculator, ListChecks, Plus, Trash2, Mic } from "lucide-react";

export default function TradeGateApp() {
  const [sleep, setSleep] = useState(7);
  const [anxiety, setAnxiety] = useState(5);
  const [urge, setUrge] = useState(5);
  const [anger, setAnger] = useState(2);
  const [dailyPnl, setDailyPnl] = useState(0);
  const [lossLimit] = useState(-1000);
  const [tradesToday, setTradesToday] = useState(0);
  const [plan, setPlan] = useState(false);
  const [newsChecked, setNewsChecked] = useState(false);
  const [stopSet, setStopSet] = useState(false);
  const [revenge, setRevenge] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");

  const startVoiceInput = (onText) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Голосовой ввод не поддерживается в этом браузере. Попробуй Chrome или Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceStatus("Слушаю… говори комментарий");
    recognition.onerror = () => setVoiceStatus("Не получилось распознать голос. Попробуй ещё раз.");
    recognition.onend = () => setTimeout(() => setVoiceStatus(""), 2500);

    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      if (text) onText(text);
      setVoiceStatus("Комментарий добавлен голосом");
    };

    recognition.start();
  };

  const [symbol, setSymbol] = useState("BCOUSD");
  const [direction, setDirection] = useState("long");
  const [entryReason, setEntryReason] = useState("");
  const [entryPrice, setEntryPrice] = useState(85);
  const [stopPrice, setStopPrice] = useState(84.6);
  const [takePrice, setTakePrice] = useState(86);
  const [riskDollars, setRiskDollars] = useState(500);
  const [dollarsPerPointPerLot, setDollarsPerPointPerLot] = useState(1000);

  const [sessionPlans, setSessionPlans] = useState([
    {
      id: 1,
      symbol: "BCOUSD",
      direction: "long",
      entryZone: "",
      trigger: "",
      stop: "",
      take: "",
      note: "",
      resultStatus: "not_taken",
      technical: "yes",
      finalResult: "",
      archiveComment: "",
    },
  ]);

  const [archivedPlans, setArchivedPlans] = useState([]);
  const [instrumentImages, setInstrumentImages] = useState({});

  const handleInstrumentImage = (symbol, file) => {
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setInstrumentImages((images) => ({ ...images, [symbol]: imageUrl }));
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowLabel = tomorrow.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  const marketIdeas = [
    {
      symbol: "BCOUSD",
      title: "Нефть",
      bias: "Приоритет long выше 86 при удержании импульса",
      scenario: "Шорт только если будет агрессивный слив под локальный range low",
    },
    {
      symbol: "XAUUSD",
      title: "Золото",
      bias: "Следить за реакцией на новости и удержанием дневного тренда",
      scenario: "Лучше торговать только после подтверждения объёмом",
    },
    {
      symbol: "COCOA",
      title: "Какао",
      bias: "Высокая волатильность — только минимальный риск",
      scenario: "Интересен breakout после накопления",
    },
  ];

  const addSessionPlan = (symbol = "BCOUSD") => {
    setSessionPlans((plans) => [
      ...plans,
      {
        id: Date.now(),
        symbol,
        direction: "long",
        entryZone: "",
        trigger: "",
        stop: "",
        take: "",
        note: "",
        resultStatus: "not_taken",
        technical: "yes",
        finalResult: "",
        archiveComment: "",
      },
    ]);
  };

  const updateSessionPlan = (id, field, value) => {
    setSessionPlans((plans) => plans.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const removeSessionPlan = (id) => {
    setSessionPlans((plans) => plans.filter((p) => p.id !== id));
  };

  const archiveSessionPlan = (id) => {
    const planToArchive = sessionPlans.find((p) => p.id === id);
    if (!planToArchive) return;

    setArchivedPlans((plans) => [
      {
        ...planToArchive,
        archivedAt: new Date().toLocaleString("ru-RU"),
      },
      ...plans,
    ]);
    setSessionPlans((plans) => plans.filter((p) => p.id !== id));
  };

  const restoreArchivedPlan = (id) => {
    const planToRestore = archivedPlans.find((p) => p.id === id);
    if (!planToRestore) return;

    const { archivedAt, ...restoredPlan } = planToRestore;
    setSessionPlans((plans) => [restoredPlan, ...plans]);
    setArchivedPlans((plans) => plans.filter((p) => p.id !== id));
  };

  const sessionPlanReadyCount = useMemo(() => {
    return sessionPlans.filter((p) => p.symbol && p.direction && p.entryZone && p.trigger && p.stop && p.take).length;
  }, [sessionPlans]);

  const tradeMath = useMemo(() => {
    const stopDistance = Math.abs(Number(entryPrice) - Number(stopPrice));
    const takeDistance = Math.abs(Number(takePrice) - Number(entryPrice));
    const lots = stopDistance > 0 && dollarsPerPointPerLot > 0 ? riskDollars / (stopDistance * dollarsPerPointPerLot) : 0;
    const rewardDollars = lots * takeDistance * dollarsPerPointPerLot;
    const rr = stopDistance > 0 ? takeDistance / stopDistance : 0;

    const stopValid = direction === "long" ? stopPrice < entryPrice : stopPrice > entryPrice;
    const takeValid = direction === "long" ? takePrice > entryPrice : takePrice < entryPrice;

    return {
      stopDistance,
      takeDistance,
      lots,
      rewardDollars,
      rr,
      stopValid,
      takeValid,
      valid: stopDistance > 0 && takeDistance > 0 && stopValid && takeValid && entryReason.trim().length > 8,
    };
  }, [entryPrice, stopPrice, takePrice, riskDollars, dollarsPerPointPerLot, direction, entryReason]);

  const result = useMemo(() => {
    let riskScore = 0;
    let reasons = [];

    if (sleep < 6) {
      riskScore += 3;
      reasons.push("мало сна");
    }
    if (anxiety >= 7) {
      riskScore += 3;
      reasons.push("высокая тревога");
    }
    if (urge >= 7) {
      riskScore += 4;
      reasons.push("сильное желание срочно торговать");
    }
    if (anger >= 6) {
      riskScore += 3;
      reasons.push("злость / раздражение");
    }
    if (dailyPnl <= lossLimit) {
      riskScore += 10;
      reasons.push("дневной лимит убытка достигнут");
    }
    if (tradesToday >= 3) {
      riskScore += 3;
      reasons.push("слишком много сделок за день");
    }
    if (!plan) {
      riskScore += 3;
      reasons.push("нет торгового плана");
    }
    if (!newsChecked) {
      riskScore += 2;
      reasons.push("новости не проверены");
    }
    if (!stopSet) {
      riskScore += 5;
      reasons.push("стоп не определён заранее");
    }
    if (revenge) {
      riskScore += 8;
      reasons.push("есть желание отбиться");
    }
    if (!tradeMath.valid) {
      riskScore += 5;
      reasons.push("план сделки заполнен некорректно");
    }
    if (sessionPlanReadyCount === 0) {
      riskScore += 3;
      reasons.push("нет готового плана следующей сессии");
    }
    if (tradeMath.rr > 0 && tradeMath.rr < 1.5) {
      riskScore += 2;
      reasons.push("слабое соотношение риск/прибыль");
    }

    if (dailyPnl <= lossLimit || revenge || !stopSet || !tradeMath.valid) {
      return {
        status: "LOCKED",
        title: "Торговать нельзя",
        subtitle: "Терминал должен быть закрыт. Только наблюдение.",
        risk: riskScore,
        reasons,
      };
    }

    if (riskScore >= 8) {
      return {
        status: "DANGER",
        title: "Лучше не торговать",
        subtitle: "Состояние нестабильное. Высокий риск сорваться в импульс.",
        risk: riskScore,
        reasons,
      };
    }

    if (riskScore >= 4) {
      return {
        status: "CAUTION",
        title: "Можно только минимальный риск",
        subtitle: "Одна сделка, риск 0.25%, без добора и без повторного входа.",
        risk: riskScore,
        reasons,
      };
    }

    return {
      status: "OK",
      title: "Торговать можно",
      subtitle: "Только по плану, с заранее заданным стопом и лимитом дня.",
      risk: riskScore,
      reasons,
    };
  }, [sleep, anxiety, urge, anger, dailyPnl, lossLimit, tradesToday, plan, newsChecked, stopSet, revenge, tradeMath, sessionPlanReadyCount]);

  const statusStyle = {
    OK: "bg-emerald-500/10 border-emerald-400/30 text-emerald-200 shadow-emerald-500/10",
    CAUTION: "bg-amber-500/10 border-amber-400/30 text-amber-200 shadow-amber-500/10",
    DANGER: "bg-orange-500/10 border-orange-400/30 text-orange-200 shadow-orange-500/10",
    LOCKED: "bg-red-500/10 border-red-400/30 text-red-200 shadow-red-500/10",
  }[result.status];

  const StatusIcon = result.status === "OK" ? CheckCircle2 : result.status === "LOCKED" ? Lock : AlertTriangle;

  const reset = () => {
    setSleep(7);
    setAnxiety(5);
    setUrge(5);
    setAnger(2);
    setDailyPnl(0);
    setTradesToday(0);
    setPlan(false);
    setNewsChecked(false);
    setStopSet(false);
    setRevenge(false);
    setEntryReason("");
    setEntryPrice(85);
    setStopPrice(84.6);
    setTakePrice(86);
    setRiskDollars(500);
    setSessionPlans([
      {
        id: 1,
        symbol: "BCOUSD",
        direction: "long",
        entryZone: "",
        trigger: "",
        stop: "",
        take: "",
        note: "",
        resultStatus: "not_taken",
        technical: "yes",
        finalResult: "",
        archiveComment: "",
      },
    ]);
    setArchivedPlans([]);
  };

  return (
    <div className="min-h-screen bg-[#07080b] p-4 text-neutral-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-300/80 shadow-2xl backdrop-blur">
                Prop Risk Control System
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Trade Gate</h1>
              <p className="mt-2 text-sm text-neutral-400">Личный терминал допуска к сделке: состояние · риск · план · дисциплина.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right shadow-2xl backdrop-blur md:block">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Account Mode</div>
              <div className="mt-1 text-lg font-semibold text-neutral-100">100K Challenge</div>
            </div>
          </div>
        </motion.div>

        {voiceStatus && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-xl">
            {voiceStatus}
          </div>
        )}

        <Card className={`overflow-hidden rounded-[2rem] border shadow-2xl backdrop-blur-xl ${statusStyle}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-2xl">
                <StatusIcon className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-semibold">{result.title}</div>
                <div className="mt-1 text-sm text-neutral-300">{result.subtitle}</div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Risk Score</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.min(result.risk * 8, 100)}%` }} />
                  </div>
                  <div className="font-mono text-sm text-neutral-200">{result.risk}</div>
                </div>
                {result.reasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.reasons.map((r) => (
                      <span key={r} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-neutral-200 shadow-sm">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-5">
              <SectionTitle icon={<Timer className="h-4 w-4" />} title="Состояние" />
              <Slider label="Сон, часов" value={sleep} setValue={setSleep} min={0} max={10} suffix="ч" />
              <Slider label="Тревога" value={anxiety} setValue={setAnxiety} min={0} max={10} />
              <Slider label="Желание срочно торговать" value={urge} setValue={setUrge} min={0} max={10} />
              <Slider label="Злость / раздражение" value={anger} setValue={setAnger} min={0} max={10} />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-5">
              <SectionTitle icon={<Shield className="h-4 w-4" />} title="Риск-контроль" />
              <NumberInput label="PnL за день, $" value={dailyPnl} setValue={setDailyPnl} />
              <NumberInput label="Сделок сегодня" value={tradesToday} setValue={setTradesToday} />
              <Toggle label="Есть чёткий план сделки" value={plan} setValue={setPlan} />
              <Toggle label="Новости проверены" value={newsChecked} setValue={setNewsChecked} />
              <Toggle label="Стоп заранее определён" value={stopSet} setValue={setStopSet} />
              <Toggle label="Есть желание отбиться" value={revenge} setValue={setRevenge} danger />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Торговый план на ${tomorrowLabel}`} />
              <Button onClick={addSessionPlan} variant="outline" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Добавить сценарий
              </Button>
            </div>

            <div className="space-y-5">
              {marketIdeas.map((idea) => {
                const plansForInstrument = sessionPlans.filter((p) => p.symbol === idea.symbol);

                return (
                  <div key={idea.symbol} className="rounded-[2rem] border border-white/10 bg-black/20 p-4 shadow-xl">
                    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{idea.symbol}</div>
                            <div className="mt-1 text-2xl font-semibold text-neutral-100">{idea.title}</div>
                          </div>
                          <Button onClick={() => addSessionPlan(idea.symbol)} variant="outline" className="rounded-xl">
                            <Plus className="mr-2 h-4 w-4" />
                            Сценарий
                          </Button>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300">
                          {idea.bias}
                        </div>

                        <div className="mt-3 text-sm text-neutral-500">
                          {idea.scenario}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-500">Картинка / график</div>
                        {instrumentImages[idea.symbol] ? (
                          <img src={instrumentImages[idea.symbol]} alt={`chart ${idea.symbol}`} className="h-36 w-full rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-neutral-600">
                            Прикрепи скрин графика<br />для этого инструмента
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleInstrumentImage(idea.symbol, e.target.files?.[0])}
                          className="mt-3 w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-neutral-100"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {plansForInstrument.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-500">
                          Пока нет сценариев по этому инструменту. Добавь сценарий только здесь, внутри нужного инструмента.
                        </div>
                      ) : (
                        plansForInstrument.map((item, index) => {
                          const ready = item.symbol && item.direction && item.entryZone && item.trigger && item.stop && item.take;
                          return (
                            <div key={item.id} className={`rounded-2xl border p-4 ${ready ? "border-emerald-400/30 bg-emerald-500/10 text-neutral-100" : "border-white/10 bg-black/25 text-neutral-100"}`}>
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold">Сценарий {index + 1}</div>
                                  <div className="text-xs text-neutral-500">{ready ? "Готов к исполнению" : "Нужно заполнить все ключевые поля"}</div>
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={() => archiveSessionPlan(item.id)} variant="outline" className="rounded-xl">
                                    В архив
                                  </Button>
                                  <Button onClick={() => removeSessionPlan(item.id)} variant="outline" className="rounded-xl">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <SelectInput label="Направление" value={item.direction} setValue={(v) => updateSessionPlan(item.id, "direction", v)} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }, { value: "both", label: "Оба сценария" }]} />
                                <TextInput label="Зона / точка входа" value={item.entryZone} setValue={(v) => updateSessionPlan(item.id, "entryZone", v)} />
                                <TextInput label="Триггер входа" value={item.trigger} setValue={(v) => updateSessionPlan(item.id, "trigger", v)} />
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <TextInput label="Стоп" value={item.stop} setValue={(v) => updateSessionPlan(item.id, "stop", v)} />
                                <TextInput label="Тейк" value={item.take} setValue={(v) => updateSessionPlan(item.id, "take", v)} />
                              </div>

                              <label className="mt-3 block">
                                <div className="mb-1 text-sm text-neutral-300">Комментарий / отмена сценария</div>
                                <div className="flex gap-2">
                                  <textarea
                                    value={item.note}
                                    onChange={(e) => updateSessionPlan(item.id, "note", e.target.value)}
                                    placeholder="Например: если уровень пробит без ретеста — не вхожу; если есть резкая новость — жду 15 минут"
                                    className="min-h-20 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => startVoiceInput((text) => updateSessionPlan(item.id, "note", item.note ? `${item.note} ${text}` : text))}
                                    variant="outline"
                                    className="h-11 rounded-xl"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                </div>
                              </label>

                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                <SelectInput label="Итог" value={item.resultStatus} setValue={(v) => updateSessionPlan(item.id, "resultStatus", v)} options={[{ value: "not_taken", label: "Входа не было" }, { value: "take", label: "Тейк" }, { value: "stop", label: "Стоп" }, { value: "manual_profit", label: "Ручное закрытие в плюс" }, { value: "manual_loss", label: "Ручное закрытие в минус" }, { value: "breakeven", label: "Безубыток" }]} />
                                <SelectInput label="Техничная сделка?" value={item.technical} setValue={(v) => updateSessionPlan(item.id, "technical", v)} options={[{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "partial", label: "Частично" }]} />
                                <NumberInput label="Финрезультат, $" value={item.finalResult} setValue={(v) => updateSessionPlan(item.id, "finalResult", v)} />
                              </div>

                              <label className="mt-3 block">
                                <div className="mb-1 text-sm text-neutral-300">Комментарий для архива</div>
                                <div className="flex gap-2">
                                  <textarea
                                    value={item.archiveComment}
                                    onChange={(e) => updateSessionPlan(item.id, "archiveComment", e.target.value)}
                                    placeholder="Что сработало / что нарушила / почему входа не было / что улучшить завтра"
                                    className="min-h-20 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => startVoiceInput((text) => updateSessionPlan(item.id, "archiveComment", item.archiveComment ? `${item.archiveComment} ${text}` : text))}
                                    variant="outline"
                                    className="h-11 rounded-xl"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                </div>
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
              Готовых сценариев: <span className="font-semibold">{sessionPlanReadyCount}</span>. Если нет ни одного готового сценария — приложение добавляет риск и не даёт торговать “с листа”.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Архив торговых планов" />
            {archivedPlans.length === 0 ? (
              <div className="rounded-xl bg-neutral-100 px-3 py-3 text-sm text-neutral-600">
                Архив пока пуст. После сессии заполни итог и нажми “В архив”.
              </div>
            ) : (
              <div className="space-y-3">
                {archivedPlans.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.symbol} · {item.direction.toUpperCase()} · {item.entryZone}</div>
                        <div className="mt-1 text-xs text-neutral-500">Архивировано: {item.archivedAt}</div>
                      </div>
                      <Button onClick={() => restoreArchivedPlan(item.id)} variant="outline" className="rounded-xl">
                        Вернуть
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                      <ArchiveField title="Триггер" value={item.trigger} />
                      <ArchiveField title="Стоп" value={item.stop} />
                      <ArchiveField title="Тейк" value={item.take} />
                      <ArchiveField title="Финрезультат" value={item.finalResult ? `$${item.finalResult}` : "—"} />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                      <ArchiveField title="Итог" value={formatResultStatus(item.resultStatus)} />
                      <ArchiveField title="Техничность" value={formatTechnical(item.technical)} />
                      <ArchiveField title="Отмена сценария" value={item.note || "—"} />
                    </div>

                    {item.archiveComment && (
                      <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-700">
                        {item.archiveComment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <SectionTitle icon={<Calculator className="h-4 w-4" />} title="План конкретной сделки и расчёт лота" />

            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="Инструмент" value={symbol} setValue={setSymbol} />
              <SelectInput label="Направление" value={direction} setValue={setDirection} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} />
              <NumberInput label="Риск на сделку, $" value={riskDollars} setValue={setRiskDollars} />
            </div>

            <label className="block">
              <div className="mb-1 text-sm">Причина входа</div>
              <textarea
                value={entryReason}
                onChange={(e) => setEntryReason(e.target.value)}
                placeholder="Например: ретест уровня, импульс, подтверждение объёмом, стоп за локальный экстремум"
                className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-4">
              <NumberInput label="Вход" value={entryPrice} setValue={setEntryPrice} />
              <NumberInput label="Стоп" value={stopPrice} setValue={setStopPrice} />
              <NumberInput label="Тейк" value={takePrice} setValue={setTakePrice} />
              <NumberInput label="$ за 1 пункт на 1 лот" value={dollarsPerPointPerLot} setValue={setDollarsPerPointPerLot} />
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-4">
              <Rule title="Лот" value={Number.isFinite(tradeMath.lots) ? tradeMath.lots.toFixed(2) : "—"} />
              <Rule title="Стоп, пунктов" value={tradeMath.stopDistance.toFixed(2)} />
              <Rule title="Потенциал" value={`$${tradeMath.rewardDollars.toFixed(0)}`} />
              <Rule title="R:R" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
            </div>

            {!tradeMath.stopValid && <Warning text="Стоп стоит с неправильной стороны от входа." />}
            {!tradeMath.takeValid && <Warning text="Тейк стоит с неправильной стороны от входа." />}
            {entryReason.trim().length > 0 && entryReason.trim().length <= 8 && <Warning text="Причина входа слишком короткая. Это похоже на импульс, а не на план." />}
            {tradeMath.rr > 0 && tradeMath.rr < 1.5 && <Warning text="R:R ниже 1:1.5. Для тебя это повышенный риск эмоционального добора." />}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="p-5">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Правило для 100k аккаунта" />
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <Rule title="Дневной стоп" value="$1000" />
              <Rule title="Риск на сделку" value="0.25–0.5%" />
              <Rule title="Максимум сделок" value="1–2 идеи" />
            </div>
            <p className="mt-4 text-sm text-neutral-600">Если статус красный — не спорить с приложением. Это не рекомендация, а запрет на торговлю.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={reset} variant="outline" className="rounded-xl">Сбросить проверку</Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
      {icon}
      {title}
    </div>
  );
}

function Slider({ label, value, setValue, min, max, suffix = "" }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm text-neutral-300">
        <span>{label}</span>
        <span className="font-medium">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function NumberInput({ label, value, setValue }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (/^-?\d*\.?\d*$/.test(raw)) {
            setValue(raw);
          }
        }}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}

function TextInput({ label, value, setValue }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}

function SelectInput({ label, value, setValue, options }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, value, setValue, danger = false }) {
  return (
    <button
      type="button"
      onClick={() => setValue(!value)}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
        value ? (danger ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200") : "border-white/10 bg-black/30 text-neutral-200"
      }`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value ? "Да" : "Нет"}</span>
    </button>
  );
}

function Rule({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function ArchiveField({ title, value }) {
  return (
    <div className="rounded-xl bg-neutral-100 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function formatResultStatus(status) {
  const map = {
    not_taken: "Входа не было",
    take: "Тейк",
    stop: "Стоп",
    manual_profit: "Ручное закрытие в плюс",
    manual_loss: "Ручное закрытие в минус",
    breakeven: "Безубыток",
  };
  return map[status] || status;
}

function formatTechnical(value) {
  const map = {
    yes: "Да",
    no: "Нет",
    partial: "Частично",
  };
  return map[value] || value;
}

function Warning({ text }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {text}
    </div>
  );
}

