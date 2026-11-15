import React from 'react';
import { Plus } from 'lucide-react';
import { formatEuro } from '../lib/format';

export interface DonutSlice {
  id: string;
  name: string;
  color: string;
  amountCents: number;
  percentage: number;
}

interface DonutChartProps {
  slices: DonutSlice[];
  totalCents: number;
  flowTab: 'expense' | 'income';
  selectedSliceId: string | null;
  onSelectSlice: (id: string | null) => void;
  onOpenAdd: () => void;
}

export function DonutChart({
  slices,
  totalCents,
  flowTab,
  selectedSliceId,
  onSelectSlice,
  onOpenAdd,
}: DonutChartProps) {
  const size = 236;
  const center = size / 2;
  const radius = 88;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  const activeSlice = selectedSliceId
    ? slices.find((s) => s.id === selectedSliceId) || null
    : null;

  let cumulativeFraction = 0;

  return (
    <div className="relative flex items-center justify-center py-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Background track ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-200/80 dark:text-slate-800"
            strokeWidth={strokeWidth}
          />

          {/* Signature subtle inner dashed ring inspired by Innim Money Manager */}
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2 - 8}
            fill="none"
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700/80"
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />

          {/* Proportional category slices */}
          {totalCents > 0 &&
            slices.map((slice) => {
              const fraction = slice.amountCents / totalCents;
              const gap = slices.length > 1 ? 2.5 : 0;
              const arcLength = Math.max(0, fraction * circumference - gap);
              const dashArray = `${arcLength} ${circumference}`;
              const rotation = cumulativeFraction * 360 - 90;
              cumulativeFraction += fraction;

              const isSelected = selectedSliceId === slice.id;
              const isDimmed = selectedSliceId !== null && !isSelected;

              return (
                <circle
                  key={slice.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isSelected ? strokeWidth + 5 : strokeWidth}
                  strokeDasharray={dashArray}
                  transform={`rotate(${rotation} ${center} ${center})`}
                  onClick={() =>
                    onSelectSlice(isSelected ? null : slice.id)
                  }
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                  }}
                />
              );
            })}
        </svg>

        {/* Center total or active slice summary */}
        <button
          type="button"
          onClick={() => onSelectSlice(null)}
          className="absolute inset-0 m-auto w-36 h-36 rounded-full flex flex-col items-center justify-center text-center px-2 focus:outline-none"
        >
          {activeSlice ? (
            <>
              <span
                className="text-xs font-semibold truncate max-w-[120px]"
                style={{ color: activeSlice.color }}
              >
                {activeSlice.name}
              </span>
              <span className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-0.5">
                {formatEuro(activeSlice.amountCents)}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {Math.round(activeSlice.percentage)}% del totale
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {flowTab === 'expense' ? 'Totale Spese' : 'Totale Entrate'}
              </span>
              <span
                className={`text-2xl font-extrabold tabular-nums mt-0.5 ${
                  totalCents === 0
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatEuro(totalCents)}
              </span>
              {totalCents === 0 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Nessuna voce
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Iconic Floating '+' Button on bottom-right of the Donut Card */}
      <button
        type="button"
        onClick={onOpenAdd}
        aria-label="Aggiungi operazione"
        className="absolute bottom-2 right-3 w-14 h-14 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center transition"
      >
        <Plus className="w-7 h-7 stroke-[2.75]" />
      </button>
    </div>
  );
}
