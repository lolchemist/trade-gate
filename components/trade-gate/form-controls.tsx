import type { ReactNode } from "react";
import type { SelectOption } from "./types";

type ValueSetter<T> = (value: T) => void;

export function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
      {icon}
      {title}
    </div>
  );
}

export function Slider({
  label,
  value,
  setValue,
  min,
  max,
  suffix = "",
}: {
  label: string;
  value: number;
  setValue: ValueSetter<number>;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm text-neutral-300">
        <span>{label}</span>
        <span className="font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string | number;
  setValue: ValueSetter<string>;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          const raw = event.target.value.replace(",", ".");
          if (/^-?\d*\.?\d*$/.test(raw)) {
            setValue(raw);
          }
        }}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}

export function TextInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: ValueSetter<string>;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}

export function SelectInput<T extends string>({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: T;
  setValue: ValueSetter<T>;
  options: SelectOption<T>[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value as T)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  value,
  setValue,
  danger = false,
}: {
  label: string;
  value: boolean;
  setValue: ValueSetter<boolean>;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => setValue(!value)}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
        value
          ? danger
            ? "border-rose-200/20 bg-rose-200/[0.07] text-rose-100"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-black/30 text-neutral-200"
      }`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value ? "Да" : "Нет"}</span>
    </button>
  );
}

export function Rule({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

export function Warning({ text }: { text: string }) {
  return <div className="rounded-xl border border-rose-200/20 bg-rose-200/[0.07] px-3 py-2 text-sm text-rose-100">{text}</div>;
}

export function ArchiveField({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-1 font-medium text-neutral-100">{value}</div>
    </div>
  );
}
