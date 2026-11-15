import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatEuro, getMonthShortName, todayISO } from '../lib/format';

export function StatsView() {
  const { transactions, selectedAccountFilter } = useFinance();
  const currentYear = Number(todayISO().slice(0, 4)) || 2026;
  const [year, setYear] = useState(currentYear);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => ({
      monthIndex: idx,
      label: getMonthShortName(idx),
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
    }));

    for (const tx of transactions) {
      if (!tx.occurredOn.startsWith(`${year}-`)) continue;
      if (selectedAccountFilter !== 'all' && tx.accountId !== selectedAccountFilter) {
        continue;
      }
      const mIdx = Number(tx.occurredOn.slice(5, 7)) - 1;
      if (mIdx < 0 || mIdx > 11) continue;
      if (tx.kind === 'income') months[mIdx].incomeCents += tx.amountCents;
      else if (tx.kind === 'expense') months[mIdx].expenseCents += tx.amountCents;
    }

    for (const m of months) {
      m.netCents = m.incomeCents - m.expenseCents;
    }
    return months;
  }, [transactions, year, selectedAccountFilter]);

  const totals = useMemo(() => {
    const income = monthlyData.reduce((s, m) => s + m.incomeCents, 0);
    const expense = monthlyData.reduce((s, m) => s + m.expenseCents, 0);
    const activeMonths =
      monthlyData.filter((m) => m.incomeCents > 0 || m.expenseCents > 0).length || 1;
    return {
      income,
      expense,
      net: income - expense,
      avgMonthlyExpense: Math.round(expense / activeMonths),
      savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    };
  }, [monthlyData]);

  const maxBarValue = useMemo(() => {
    const max = Math.max(
      100,
      ...monthlyData.map((m) => Math.max(m.incomeCents, m.expenseCents))
    );
    return max;
  }, [monthlyData]);

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Year Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-extrabold text-slate-900 dark:text-white">
          Bilancio {year}
        </span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
            <TrendingUp className="w-4 h-4" />
            Entrate {year}
          </div>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">
            {formatEuro(totals.income)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
            <TrendingDown className="w-4 h-4" />
            Spese {year}
          </div>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">
            {formatEuro(totals.expense)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Risparmio Netto</p>
          <p
            className={`text-lg font-extrabold tabular-nums mt-1 ${
              totals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {formatEuro(totals.net, { showPlus: true })}
          </p>
          {totals.income > 0 && (
            <p className="text-[11px] text-slate-400">
              Tasso risparmio: {totals.savingsRate}%
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Media Spese / Mese</p>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">
            {formatEuro(totals.avgMonthlyExpense)}
          </p>
          <p className="text-[11px] text-slate-400">Sui mesi attivi</p>
        </div>
      </div>

      {/* Monthly Bar Chart: Entrate vs Spese */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Andamento Mensile
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-emerald-500">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
              Entrate
            </span>
            <span className="flex items-center gap-1 text-rose-500">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
              Spese
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-1.5 items-end h-44 pt-4">
          {monthlyData.map((m) => {
            const incHeight = Math.round((m.incomeCents / maxBarValue) * 100);
            const expHeight = Math.round((m.expenseCents / maxBarValue) * 100);
            return (
              <div
                key={m.monthIndex}
                className="flex flex-col items-center h-full justify-end gap-1.5"
              >
                <div className="w-full flex-1 flex items-end justify-center gap-0.5">
                  <div
                    className="w-2 rounded-t-sm bg-emerald-500 transition-all"
                    style={{
                      height: `${m.incomeCents > 0 ? Math.max(6, incHeight) : 2}%`,
                      opacity: m.incomeCents > 0 ? 1 : 0.2,
                    }}
                    title={`Entrate ${m.label}: ${formatEuro(m.incomeCents)}`}
                  />
                  <div
                    className="w-2 rounded-t-sm bg-rose-500 transition-all"
                    style={{
                      height: `${m.expenseCents > 0 ? Math.max(6, expHeight) : 2}%`,
                      opacity: m.expenseCents > 0 ? 1 : 0.2,
                    }}
                    title={`Spese ${m.label}: ${formatEuro(m.expenseCents)}`}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month-by-Month Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
          Dettaglio Mesi {year}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {monthlyData.map((m) => (
            <div
              key={m.monthIndex}
              className="px-4 py-3 flex items-center justify-between text-xs"
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 w-14">
                {m.label}
              </span>
              <span className="tabular-nums text-emerald-500">
                +{formatEuro(m.incomeCents)}
              </span>
              <span className="tabular-nums text-rose-500">
                -{formatEuro(m.expenseCents)}
              </span>
              <span
                className={`font-bold tabular-nums min-w-[78px] text-right ${
                  m.netCents >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-500'
                }`}
              >
                {formatEuro(m.netCents, { showPlus: true })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
