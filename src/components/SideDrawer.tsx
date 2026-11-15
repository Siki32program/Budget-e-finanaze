import React from 'react';
import {
  BarChart3,
  CalendarClock,
  Cloud,
  FileSpreadsheet,
  FolderKanban,
  Home,
  Lock,
  Moon,
  ReceiptText,
  Settings,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatEuro } from '../lib/format';
import type { AppView } from '../types/finance';

interface SideDrawerProps {
  open: boolean;
  currentView: AppView;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
  { view: 'home', label: 'Dashboard', icon: Home },
  { view: 'operations', label: 'Operazioni & Ricerca', icon: ReceiptText },
  { view: 'accounts', label: 'Conti & Trasferimenti', icon: Wallet },
  { view: 'categories', label: 'Categorie & Limiti Mese', icon: FolderKanban },
  { view: 'recurring', label: 'Pagamenti Regolari', icon: CalendarClock },
  { view: 'stats', label: 'Statistiche & Trend', icon: BarChart3 },
  { view: 'import_export', label: 'Importa / Esporta Excel', icon: FileSpreadsheet },
  { view: 'settings', label: 'Cloud, PIN & Impostazioni', icon: Settings },
];

export function SideDrawer({
  open,
  currentView,
  onClose,
  onNavigate,
}: SideDrawerProps) {
  const {
    totalBalanceCents,
    settings,
    updateSettings,
    cloudUser,
    dueManualRules,
    lockApp,
  } = useFinance();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
      onClick={onClose}
    >
      <aside
        className="w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Header */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 text-white p-5 pt-[max(1.25rem,var(--safe-top))]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center font-extrabold text-xl text-amber-300 shadow-inner">
                €
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">Siki Budget</h2>
                <p className="text-xs text-emerald-200/80">Finanze personali</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-black/20 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                Disponibilità totale
              </p>
              <p className="text-lg font-bold tabular-nums">
                {formatEuro(totalBalanceCents)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigate('settings');
                onClose();
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 ${
                cloudUser
                  ? 'bg-emerald-400/20 text-emerald-100'
                  : 'bg-amber-400/20 text-amber-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              {cloudUser ? 'Cloud ON' : 'Solo locale'}
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.view;
            const showDue = item.view === 'recurring' && dueManualRules.length > 0;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => {
                  onNavigate(item.view);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 ${
                      active
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  {item.label}
                </span>
                {showDue && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-slate-950">
                    {dueManualRules.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom quick actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 pb-[max(0.75rem,var(--safe-bottom))]">
          <button
            type="button"
            onClick={() =>
              updateSettings({
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {settings.theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                Tema Chiaro
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-500" />
                Tema Scuro
              </>
            )}
          </button>

          {settings.pinCodeHash && (
            <button
              type="button"
              onClick={() => {
                onClose();
                lockApp();
              }}
              title="Blocca subito con PIN"
              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4 text-emerald-500" />
              Blocca
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
