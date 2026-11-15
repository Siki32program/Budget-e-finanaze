import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileSpreadsheet,
  Plus,
  SkipForward,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  formatEuro,
  formatPeriodLabel,
  formatShortDate,
  getPeriodBounds,
  shiftPeriodAnchor,
  todayISO,
} from '../lib/format';
import { DynamicIcon } from '../lib/icons';
import type {
  AppView,
  MainFlowTab,
  PeriodMode,
  Transaction,
  TransactionKind,
} from '../types/finance';
import { DonutChart, type DonutSlice } from './DonutChart';

const PERIOD_TABS: { mode: PeriodMode; label: string }[] = [
  { mode: 'day', label: 'Giorno' },
  { mode: 'week', label: 'Settimana' },
  { mode: 'month', label: 'Mese' },
  { mode: 'year', label: 'Anno' },
  { mode: 'custom', label: 'Periodo' },
];

interface HomeDashboardProps {
  flowTab: MainFlowTab;
  onChangeFlowTab: (tab: MainFlowTab) => void;
  onOpenNewTransaction: (preset?: {
    kind?: TransactionKind;
    categoryId?: string;
  }) => void;
  onEditTransaction: (tx: Transaction) => void;
  onNavigate?: (view: AppView) => void;
}

interface CategorySummaryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  amountCents: number;
  percentage: number;
  txCount: number;
  monthlyBudgetCents: number | null;
  subBreakdown: { id: string; name: string; amountCents: number }[];
  transactions: Transaction[];
}

export function HomeDashboard({
  flowTab,
  onChangeFlowTab,
  onOpenNewTransaction,
  onEditTransaction,
  onNavigate,
}: HomeDashboardProps) {
  const {
    categories,
    transactions,
    accounts,
    selectedAccountFilter,
    period,
    setPeriod,
    settings,
    cloudUser,
    dueManualRules,
    applyRecurringRuleNow,
    skipRecurringRuleOnce,
  } = useFinance();

  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  const [hideSyncBanner, setHideSyncBanner] = useState<boolean>(false);

  const bounds = useMemo(() => getPeriodBounds(period), [period]);

  // Filter transactions in current period, flowTab, and account filter
  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.kind !== flowTab) return false;
      if (tx.occurredOn < bounds.start || tx.occurredOn > bounds.end) return false;
      if (selectedAccountFilter !== 'all' && tx.accountId !== selectedAccountFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, flowTab, bounds, selectedAccountFilter]);

  const totalPeriodCents = useMemo(
    () => periodTransactions.reduce((sum, tx) => sum + tx.amountCents, 0),
    [periodTransactions]
  );

  const categoryMap = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c]));
    return m;
  }, [categories]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const categorySummaries = useMemo<CategorySummaryItem[]>(() => {
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        icon: string;
        color: string;
        monthlyBudgetCents: number | null;
        amountCents: number;
        txs: Transaction[];
        subs: Map<string, { id: string; name: string; amountCents: number }>;
      }
    >();

    for (const tx of periodTransactions) {
      const rawCat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      // Resolve parent if categoryId happened to be a subcategory
      const parentCat =
        rawCat && rawCat.parentId
          ? categoryMap.get(rawCat.parentId) ?? rawCat
          : rawCat;

      const groupId = parentCat?.id ?? 'uncategorized';
      let entry = groups.get(groupId);
      if (!entry) {
        entry = {
          id: groupId,
          name: parentCat?.name ?? 'Senza categoria',
          icon: parentCat?.icon ?? 'other',
          color: parentCat?.color ?? '#64748b',
          monthlyBudgetCents: parentCat?.monthlyBudgetCents ?? null,
          amountCents: 0,
          txs: [],
          subs: new Map(),
        };
        groups.set(groupId, entry);
      }
      entry.amountCents += tx.amountCents;
      entry.txs.push(tx);

      const subCat = tx.subcategoryId ? categoryMap.get(tx.subcategoryId) : undefined;
      if (subCat) {
        const prevSub = entry.subs.get(subCat.id) ?? {
          id: subCat.id,
          name: subCat.name,
          amountCents: 0,
        };
        prevSub.amountCents += tx.amountCents;
        entry.subs.set(subCat.id, prevSub);
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.amountCents - a.amountCents)
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        amountCents: g.amountCents,
        percentage: totalPeriodCents > 0 ? (g.amountCents / totalPeriodCents) * 100 : 0,
        txCount: g.txs.length,
        monthlyBudgetCents: g.monthlyBudgetCents,
        subBreakdown: Array.from(g.subs.values()).sort(
          (a, b) => b.amountCents - a.amountCents
        ),
        transactions: g.txs,
      }));
  }, [periodTransactions, categoryMap, totalPeriodCents]);

  const donutSlices = useMemo<DonutSlice[]>(() => {
    if (!settings.groupSmallCategories || categorySummaries.length <= 4) {
      return categorySummaries.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amountCents: c.amountCents,
        percentage: c.percentage,
      }));
    }
    const major: DonutSlice[] = [];
    let minorCents = 0;
    for (const c of categorySummaries) {
      if (c.percentage >= 3) {
        major.push({
          id: c.id,
          name: c.name,
          color: c.color,
          amountCents: c.amountCents,
          percentage: c.percentage,
        });
      } else {
        minorCents += c.amountCents;
      }
    }
    if (minorCents > 0) {
      major.push({
        id: '__minor__',
        name: 'Spese minori (<3%)',
        color: '#64748b',
        amountCents: minorCents,
        percentage: totalPeriodCents > 0 ? (minorCents / totalPeriodCents) * 100 : 0,
      });
    }
    return major;
  }, [categorySummaries, settings.groupSmallCategories, totalPeriodCents]);

  const drillItem = drillCategoryId
    ? categorySummaries.find((c) => c.id === drillCategoryId) || null
    : null;

  return (
    <div className="pb-10">
      {/* SPESE / ENTRATE Main Tabs inside top emerald header extension */}
      <div className="bg-emerald-900 dark:bg-slate-950 px-4 pb-6 rounded-b-[2rem] shadow-sm">
        <div className="max-w-lg mx-auto grid grid-cols-2 bg-black/20 dark:bg-slate-900/90 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              onChangeFlowTab('expense');
              setSelectedSliceId(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              flowTab === 'expense'
                ? 'bg-white text-emerald-950 dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                : 'text-emerald-100/75 hover:text-white'
            }`}
          >
            Spese
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeFlowTab('income');
              setSelectedSliceId(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              flowTab === 'income'
                ? 'bg-white text-emerald-950 dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                : 'text-emerald-100/75 hover:text-white'
            }`}
          >
            Entrate
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {/* One-time onboarding banner when local DB has 0 transactions and user hasn't signed in to Cloud yet */}
        {!cloudUser && transactions.length === 0 && !hideSyncBanner && onNavigate && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/70 dark:border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <Cloud className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Storico 2026 &ldquo;Budget e finanze&rdquo; pronto nel Cloud</span>
              </div>
              <button
                type="button"
                onClick={() => setHideSyncBanner(true)}
                aria-label="Chiudi avviso"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Connetti il tuo Cloud Privato Supabase per sincronizzare subito tutte le tue operazioni 2026 su Web e Android, oppure importa un file Excel.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Cloud className="w-3.5 h-3.5" />
                Sincronizza Cloud
              </button>
              <button
                type="button"
                onClick={() => onNavigate('import_export')}
                className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                Excel .xlsx
              </button>
            </div>
          </div>
        )}

        {/* Due manual recurring reminders banner */}
        {dueManualRules.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>
                {dueManualRules.length === 1
                  ? '1 pagamento regolare in scadenza'
                  : `${dueManualRules.length} pagamenti regolari in scadenza`}
              </span>
            </div>
            {dueManualRules.slice(0, 2).map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-2 bg-white/80 dark:bg-slate-900/70 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {rule.title} · {formatEuro(rule.amountCents)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Scadenza: {formatShortDate(rule.nextDueOn)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => skipRecurringRuleOnce(rule.id)}
                    title="Salta questa rata"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRecurringRuleNow(rule.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Registra
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Card: Period Selector + Donut Chart + '+' Button */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/90">
          {/* Period Mode Tabs */}
          <div className="flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-2.5 overflow-x-auto no-scrollbar">
            {PERIOD_TABS.map((t) => {
              const active = period.mode === t.mode;
              return (
                <button
                  key={t.mode}
                  type="button"
                  onClick={() => {
                    setPeriod((prev) => ({ ...prev, mode: t.mode }));
                    setSelectedSliceId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Period Navigation or Custom Date Inputs */}
          {period.mode !== 'custom' ? (
            <div className="flex items-center justify-between pt-3 px-1">
              <button
                type="button"
                onClick={() => {
                  setPeriod((prev) => ({
                    ...prev,
                    anchorDate: shiftPeriodAnchor(prev.mode, prev.anchorDate, -1),
                  }));
                  setSelectedSliceId(null);
                }}
                aria-label="Periodo precedente"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setPeriod((prev) => ({ ...prev, anchorDate: todayISO() }))
                }
                title="Tocca per tornare a oggi"
                className="text-sm font-semibold text-slate-800 dark:text-slate-100 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
              >
                {formatPeriodLabel(period)}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPeriod((prev) => ({
                    ...prev,
                    anchorDate: shiftPeriodAnchor(prev.mode, prev.anchorDate, 1),
                  }));
                  setSelectedSliceId(null);
                }}
                aria-label="Periodo successivo"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-3">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                  Dal
                </label>
                <input
                  type="date"
                  value={period.customStart}
                  onChange={(e) =>
                    setPeriod((prev) => ({
                      ...prev,
                      customStart: e.target.value || prev.customStart,
                    }))
                  }
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white border border-transparent focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                  Al
                </label>
                <input
                  type="date"
                  value={period.customEnd}
                  onChange={(e) =>
                    setPeriod((prev) => ({
                      ...prev,
                      customEnd: e.target.value || prev.customEnd,
                    }))
                  }
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white border border-transparent focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Central Donut Chart + Floating '+' */}
          <DonutChart
            slices={donutSlices}
            totalCents={totalPeriodCents}
            flowTab={flowTab}
            selectedSliceId={selectedSliceId}
            onSelectSlice={setSelectedSliceId}
            onOpenAdd={() => onOpenNewTransaction({ kind: flowTab })}
          />
        </div>

        {/* Category Breakdown List (same layout as Innim Money Manager, modernized) */}
        {categorySummaries.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 text-center border border-slate-200/80 dark:border-slate-800/90">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Nessuna {flowTab === 'expense' ? 'spesa' : 'entrata'} registrata in questo periodo.
            </p>
            <button
              type="button"
              onClick={() => onOpenNewTransaction({ kind: flowTab })}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Aggiungi {flowTab === 'expense' ? 'spesa' : 'entrata'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {categorySummaries.map((cat) => {
              const showBudget =
                period.mode === 'month' &&
                flowTab === 'expense' &&
                cat.monthlyBudgetCents &&
                cat.monthlyBudgetCents > 0;
              const budgetRatio = showBudget
                ? (cat.amountCents / (cat.monthlyBudgetCents || 1)) * 100
                : 0;
              const isHighlighted = selectedSliceId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setDrillCategoryId(cat.id)}
                  className={`w-full text-left bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 shadow-2xs border transition active:scale-[0.99] ${
                    isHighlighted
                      ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'border-slate-200/80 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        <DynamicIcon name={cat.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {cat.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {cat.txCount}{' '}
                          {cat.txCount === 1 ? 'operazione' : 'operazioni'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                        {cat.percentage < 1 && cat.percentage > 0
                          ? '<1%'
                          : `${Math.round(cat.percentage)}%`}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white min-w-[78px] text-right">
                        {formatEuro(cat.amountCents)}
                      </span>
                    </div>
                  </div>

                  {/* Monthly Budget Limit Indicator (shown in Month view when configured) */}
                  {showBudget && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500 dark:text-slate-400">
                          Limite mensile:{' '}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {formatEuro(cat.monthlyBudgetCents!)}
                          </strong>
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            budgetRatio > 100
                              ? 'text-rose-500'
                              : budgetRatio >= 80
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {budgetRatio > 100
                            ? `Sforato di ${formatEuro(
                                cat.amountCents - cat.monthlyBudgetCents!
                              )}`
                            : `Restano ${formatEuro(
                                cat.monthlyBudgetCents! - cat.amountCents
                              )}`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            budgetRatio > 100
                              ? 'bg-rose-500'
                              : budgetRatio >= 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, budgetRatio)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Drill-Down Modal (Subcategories + Operations in Period) */}
      {drillItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDrillCategoryId(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0"
                  style={{ backgroundColor: drillItem.color }}
                >
                  <DynamicIcon name={drillItem.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {drillItem.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatPeriodLabel(period)} ·{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatEuro(drillItem.amountCents)}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {drillItem.id !== 'uncategorized' && (
                  <button
                    type="button"
                    onClick={() => {
                      const catId = drillItem.id;
                      setDrillCategoryId(null);
                      onOpenNewTransaction({ kind: flowTab, categoryId: catId });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuova
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrillCategoryId(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-3 space-y-4">
              {drillItem.subBreakdown.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                    Dettaglio Sottocategorie
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {drillItem.subBreakdown.map((sub) => (
                      <div
                        key={sub.id}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center gap-2"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {sub.name}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatEuro(sub.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                  Operazioni ({drillItem.transactions.length})
                </p>
                <div className="space-y-1.5">
                  {drillItem.transactions.map((tx) => {
                    const sub = tx.subcategoryId
                      ? categoryMap.get(tx.subcategoryId)
                      : undefined;
                    const acc = accountMap.get(tx.accountId);
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => {
                          setDrillCategoryId(null);
                          onEditTransaction(tx);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {tx.note || sub?.name || drillItem.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {formatShortDate(tx.occurredOn)}
                            {sub ? ` · ${sub.name}` : ''}
                            {acc ? ` · ${acc.name}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                          {formatEuro(tx.amountCents)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
