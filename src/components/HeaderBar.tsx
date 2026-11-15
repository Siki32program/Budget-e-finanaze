import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatEuro } from '../lib/format';
import { DynamicIcon } from '../lib/icons';
import type { AppView } from '../types/finance';

const VIEW_TITLES: Record<AppView, string> = {
  home: 'Siki Budget',
  operations: 'Operazioni',
  accounts: 'Conti',
  categories: 'Categorie & Budget',
  recurring: 'Pagamenti Regolari',
  stats: 'Statistiche',
  import_export: 'Importa / Esporta',
  settings: 'Impostazioni',
};

interface HeaderBarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenDrawer: () => void;
}

export function HeaderBar({
  currentView,
  onNavigate,
  onOpenDrawer,
}: HeaderBarProps) {
  const {
    activeAccounts,
    accountBalances,
    totalBalanceCents,
    selectedAccountFilter,
    setSelectedAccountFilter,
    displayedBalanceCents,
    cloudUser,
    syncStatus,
    triggerSync,
  } = useFinance();

  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedAccount =
    selectedAccountFilter === 'all'
      ? null
      : activeAccounts.find((a) => a.id === selectedAccountFilter) || null;

  const isHomeOrOps = currentView === 'home' || currentView === 'operations';

  return (
    <>
      <header className="bg-gradient-to-b from-emerald-800 via-emerald-800 to-emerald-900 dark:from-emerald-950 dark:via-emerald-950 dark:to-slate-950 text-white pt-[max(0.75rem,var(--safe-top))] px-4 pb-3 select-none">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          {/* Left: Hamburger or Back */}
          {currentView === 'home' ? (
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Apri menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
            >
              <Menu className="w-6 h-6" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              aria-label="Torna alla Home"
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}

          {/* Center: Clickable Balance Filter (on Home/Operations) or View Title */}
          {isHomeOrOps ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex flex-col items-center px-3 py-1 rounded-2xl hover:bg-white/10 active:scale-98 transition min-w-0"
            >
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-emerald-100/90">
                {selectedAccount ? (
                  <>
                    <DynamicIcon name={selectedAccount.icon} className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[150px]">{selectedAccount.name}</span>
                  </>
                ) : activeAccounts.length === 1 ? (
                  <span className="truncate max-w-[160px]">{activeAccounts[0].name}</span>
                ) : (
                  <span>Saldo Totale</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </span>
              <span className="text-2xl font-bold tracking-tight tabular-nums leading-tight">
                {formatEuro(displayedBalanceCents)}
              </span>
            </button>
          ) : (
            <h1 className="text-lg font-semibold tracking-tight truncate">
              {VIEW_TITLES[currentView]}
            </h1>
          )}

          {/* Right: Sync badge + Operations quick icon */}
          <div className="flex items-center gap-1">
            {cloudUser && (
              <button
                type="button"
                onClick={() => triggerSync()}
                title={
                  syncStatus === 'syncing'
                    ? 'Sincronizzazione in corso...'
                    : syncStatus === 'offline'
                    ? 'Offline (modifiche salvate sul dispositivo)'
                    : 'Cloud sincronizzato (tocca per aggiornare)'
                }
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 text-emerald-200 animate-spin" />
                ) : syncStatus === 'offline' ? (
                  <CloudOff className="w-4 h-4 text-amber-300" />
                ) : (
                  <Cloud
                    className={`w-4 h-4 ${
                      syncStatus === 'error' ? 'text-rose-300' : 'text-emerald-200'
                    }`}
                  />
                )}
              </button>
            )}

            {currentView === 'home' ? (
              <button
                type="button"
                onClick={() => onNavigate('operations')}
                aria-label="Lista operazioni"
                title="Lista operazioni"
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
              >
                <ReceiptText className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenDrawer}
                aria-label="Menu"
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Account Selector Bottom Sheet / Popover */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Seleziona Conto
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  onNavigate('accounts');
                }}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Gestisci conti
              </button>
            </div>

            <div className="space-y-2">
              {activeAccounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountFilter('all');
                    setPickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition ${
                    selectedAccountFilter === 'all'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500/50'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      Σ
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Tutti i conti
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Somma dei conti inclusi nel totale
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatEuro(totalBalanceCents)}
                    </span>
                    {selectedAccountFilter === 'all' && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                </button>
              )}

              {activeAccounts.map((acc) => {
                const isSelected =
                  selectedAccountFilter === acc.id ||
                  (selectedAccountFilter === 'all' && activeAccounts.length === 1);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountFilter(
                        activeAccounts.length === 1 ? 'all' : acc.id
                      );
                      setPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500/50'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
                        style={{ backgroundColor: acc.color }}
                      >
                        <DynamicIcon name={acc.icon} className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </p>
                        {!acc.includeInTotal && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            Escluso dal saldo totale
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatEuro(accountBalances[acc.id] ?? 0)}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
