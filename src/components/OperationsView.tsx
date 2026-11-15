import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  formatEuro,
  formatItalianDateHeader,
  formatPeriodLabel,
  getPeriodBounds,
  shiftPeriodAnchor,
  todayISO,
} from '../lib/format';
import { DynamicIcon } from '../lib/icons';
import type { PeriodMode, Transaction, TransactionKind } from '../types/finance';

interface OperationsViewProps {
  onOpenNewTransaction: (preset?: { kind?: TransactionKind }) => void;
  onEditTransaction: (tx: Transaction) => void;
}

const PERIOD_TABS: { mode: PeriodMode | 'all_time'; label: string }[] = [
  { mode: 'day', label: 'Giorno' },
  { mode: 'week', label: 'Settimana' },
  { mode: 'month', label: 'Mese' },
  { mode: 'year', label: 'Anno' },
  { mode: 'all_time', label: 'Tutto' },
];

export function OperationsView({
  onOpenNewTransaction,
  onEditTransaction,
}: OperationsViewProps) {
  const {
    transactions,
    categories,
    accounts,
    selectedAccountFilter,
    period,
    setPeriod,
  } = useFinance();

  const [kindFilter, setKindFilter] = useState<'all' | TransactionKind>('all');
  const [allTime, setAllTime] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const bounds = useMemo(() => getPeriodBounds(period), [period]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = transactions.filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (!allTime && (tx.occurredOn < bounds.start || tx.occurredOn > bounds.end)) {
        return false;
      }
      if (selectedAccountFilter !== 'all') {
        const matchesAcc =
          tx.accountId === selectedAccountFilter ||
          tx.toAccountId === selectedAccountFilter;
        if (!matchesAcc) return false;
      }
      if (selectedCategoryIds.length > 0) {
        if (tx.kind === 'transfer') return false;
        const matchesCat =
          (tx.categoryId && selectedCategoryIds.includes(tx.categoryId)) ||
          (tx.subcategoryId && selectedCategoryIds.includes(tx.subcategoryId));
        if (!matchesCat) return false;
      }
      if (q) {
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        const sub = tx.subcategoryId ? categoryMap.get(tx.subcategoryId) : undefined;
        const fromAcc = accountMap.get(tx.accountId);
        const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
        const haystack = [
          tx.note,
          cat?.name,
          sub?.name,
          fromAcc?.name,
          toAcc?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'amount') {
      return [...list].sort((a, b) => b.amountCents - a.amountCents);
    }
    return list;
  }, [
    transactions,
    kindFilter,
    allTime,
    bounds,
    selectedAccountFilter,
    selectedCategoryIds,
    searchQuery,
    sortBy,
    categoryMap,
    accountMap,
  ]);

  const summary = useMemo(() => {
    let expenses = 0;
    let incomes = 0;
    for (const tx of filtered) {
      if (tx.kind === 'expense') expenses += tx.amountCents;
      else if (tx.kind === 'income') incomes += tx.amountCents;
    }
    return { expenses, incomes, net: incomes - expenses };
  }, [filtered]);

  // Group by date when sorted by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: Transaction[]; dayNetCents: number }[] = [];
    const map = new Map<string, { date: string; items: Transaction[]; dayNetCents: number }>();

    for (const tx of filtered) {
      let g = map.get(tx.occurredOn);
      if (!g) {
        g = { date: tx.occurredOn, items: [], dayNetCents: 0 };
        map.set(tx.occurredOn, g);
        groups.push(g);
      }
      g.items.push(tx);
      if (tx.kind === 'expense') g.dayNetCents -= tx.amountCents;
      else if (tx.kind === 'income') g.dayNetCents += tx.amountCents;
    }
    return groups;
  }, [filtered]);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId && !c.archived),
    [categories]
  );

  const toggleCategoryFilter = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-24 space-y-3">
      {/* Kind Filter Pills */}
      <div className="grid grid-cols-4 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-2xl gap-1">
        {[
          { id: 'all', label: 'Tutte' },
          { id: 'expense', label: 'Spese' },
          { id: 'income', label: 'Entrate' },
          { id: 'transfer', label: 'Trasf.' },
        ].map((t) => {
          const active = kindFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setKindFilter(t.id as typeof kindFilter)}
              className={`py-2 rounded-xl text-xs font-bold transition ${
                active
                  ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Period & Search Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
        {/* Period tabs */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {PERIOD_TABS.map((pt) => {
            const active =
              pt.mode === 'all_time'
                ? allTime
                : !allTime && period.mode === pt.mode;
            return (
              <button
                key={pt.mode}
                type="button"
                onClick={() => {
                  if (pt.mode === 'all_time') {
                    setAllTime(true);
                  } else {
                    setAllTime(false);
                    setPeriod((prev) => ({ ...prev, mode: pt.mode as PeriodMode }));
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {pt.label}
              </button>
            );
          })}
        </div>

        {!allTime && (
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() =>
                setPeriod((prev) => ({
                  ...prev,
                  anchorDate: shiftPeriodAnchor(prev.mode, prev.anchorDate, -1),
                }))
              }
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setPeriod((prev) => ({ ...prev, anchorDate: todayISO() }))
              }
              className="text-xs font-semibold text-slate-800 dark:text-slate-200 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4"
            >
              {formatPeriodLabel(period)}
            </button>
            <button
              type="button"
              onClick={() =>
                setPeriod((prev) => ({
                  ...prev,
                  anchorDate: shiftPeriodAnchor(prev.mode, prev.anchorDate, 1),
                }))
              }
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search + Sort + Category Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nota, categoria, conto..."
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 pl-9 pr-8 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSortBy((s) => (s === 'date' ? 'amount' : 'date'))}
            title="Ordina per Data o Importo"
            className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500" />
            {sortBy === 'date' ? 'Data' : 'Importo'}
          </button>

          <button
            type="button"
            onClick={() => setFilterPanelOpen((v) => !v)}
            className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 ${
              selectedCategoryIds.length > 0
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {selectedCategoryIds.length > 0 && selectedCategoryIds.length}
          </button>
        </div>

        {/* Multi-category filter panel */}
        {filterPanelOpen && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Filtra per categorie
              </span>
              {selectedCategoryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  className="text-xs font-semibold text-rose-500"
                >
                  Azzera filtri
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parentCategories.map((cat) => {
                const selected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                      selected
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <DynamicIcon name={cat.icon} className="w-3 h-3" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Period Summary Bar */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Spese</p>
            <p className="text-xs font-bold tabular-nums text-rose-500">
              -{formatEuro(summary.expenses)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Entrate</p>
            <p className="text-xs font-bold tabular-nums text-emerald-500">
              +{formatEuro(summary.incomes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400 font-semibold">Bilancio</p>
            <p
              className={`text-xs font-bold tabular-nums ${
                summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {formatEuro(summary.net, { showPlus: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Results List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200/80 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nessuna operazione trovata con i filtri selezionati.
          </p>
        </div>
      ) : sortBy === 'date' ? (
        <div className="space-y-3">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {formatItalianDateHeader(group.date)}
                </span>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    group.dayNetCents >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {formatEuro(group.dayNetCents, { showPlus: true })}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {group.items.map((tx) => (
                  <TransactionRowItem
                    key={tx.id}
                    tx={tx}
                    categoryMap={categoryMap}
                    accountMap={accountMap}
                    onClick={() => onEditTransaction(tx)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          {filtered.map((tx) => (
            <TransactionRowItem
              key={tx.id}
              tx={tx}
              showDate
              categoryMap={categoryMap}
              accountMap={accountMap}
              onClick={() => onEditTransaction(tx)}
            />
          ))}
        </div>
      )}

      {/* Floating Add FAB */}
      <button
        type="button"
        onClick={() =>
          onOpenNewTransaction({
            kind: kindFilter === 'all' ? 'expense' : kindFilter,
          })
        }
        aria-label="Nuova operazione"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 shadow-xl shadow-amber-500/25 flex items-center justify-center z-30 transition"
      >
        <Plus className="w-7 h-7 stroke-[2.75]" />
      </button>
    </div>
  );
}

function TransactionRowItem({
  tx,
  showDate,
  categoryMap,
  accountMap,
  onClick,
}: {
  tx: Transaction;
  showDate?: boolean;
  categoryMap: Map<string, { name: string; icon: string; color: string }>;
  accountMap: Map<string, { name: string }>;
  onClick: () => void;
}) {
  const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
  const sub = tx.subcategoryId ? categoryMap.get(tx.subcategoryId) : undefined;
  const fromAcc = accountMap.get(tx.accountId);
  const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;

  const isTransfer = tx.kind === 'transfer';
  const title = isTransfer
    ? `${fromAcc?.name ?? 'Conto'} → ${toAcc?.name ?? 'Conto'}`
    : cat?.name ?? 'Senza categoria';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isTransfer ? '#0ea5e9' : cat?.color ?? '#64748b',
          }}
        >
          {isTransfer ? (
            <ArrowLeftRight className="w-4 h-4" />
          ) : (
            <DynamicIcon name={cat?.icon ?? 'other'} className="w-5 h-5" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </span>
            {sub && (
              <span className="text-xs text-slate-400 truncate">· {sub.name}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {tx.note ? tx.note : fromAcc?.name ?? ''}
            {showDate ? ` · ${tx.occurredOn}` : ''}
          </p>
        </div>
      </div>

      <span
        className={`text-sm font-bold tabular-nums shrink-0 ${
          tx.kind === 'expense'
            ? 'text-slate-900 dark:text-white'
            : tx.kind === 'income'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-sky-500'
        }`}
      >
        {tx.kind === 'expense'
          ? `-${formatEuro(tx.amountCents)}`
          : tx.kind === 'income'
          ? `+${formatEuro(tx.amountCents)}`
          : formatEuro(tx.amountCents)}
      </span>
    </button>
  );
}
