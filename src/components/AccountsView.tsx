import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Edit3,
  EyeOff,
  Plus,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { centsToInputString, formatEuro, parseEuroToCents } from '../lib/format';
import { COLOR_PALETTE, DynamicIcon } from '../lib/icons';
import type { Account, TransactionKind } from '../types/finance';

const ACCOUNT_TYPES: { id: Account['type']; label: string; defaultIcon: string }[] = [
  { id: 'bank', label: 'Conto Bancario', defaultIcon: 'landmark' },
  { id: 'cash', label: 'Contanti', defaultIcon: 'banknote' },
  { id: 'card', label: 'Carta / Prepagata', defaultIcon: 'credit-card' },
  { id: 'savings', label: 'Risparmi / Deposito', defaultIcon: 'piggy-bank' },
  { id: 'investment', label: 'Investimenti', defaultIcon: 'trending-up' },
  { id: 'other', label: 'Altro', defaultIcon: 'wallet' },
];

interface AccountsViewProps {
  onOpenTransfer: (preset: { kind: TransactionKind }) => void;
}

export function AccountsView({ onOpenTransfer }: AccountsViewProps) {
  const {
    activeAccounts,
    archivedAccounts,
    accountBalances,
    totalBalanceCents,
    saveAccount,
    adjustAccountBalance,
    deleteAccount,
    moveAccountOrder,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('bank');
  const [icon, setIcon] = useState('landmark');
  const [color, setColor] = useState('#10b981');
  const [balanceInput, setBalanceInput] = useState('0');
  const [includeInTotal, setIncludeInTotal] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [adjustingAcc, setAdjustingAcc] = useState<Account | null>(null);
  const [desiredBalanceStr, setDesiredBalanceStr] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setType('bank');
    setIcon('landmark');
    setColor(COLOR_PALETTE[activeAccounts.length % COLOR_PALETTE.length]);
    setBalanceInput('0');
    setIncludeInTotal(true);
    setIsDefault(activeAccounts.length === 0);
    setModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setName(acc.name);
    setType(acc.type);
    setIcon(acc.icon);
    setColor(acc.color);
    setBalanceInput(centsToInputString(acc.initialBalanceCents) || '0');
    setIncludeInTotal(acc.includeInTotal);
    setIsDefault(acc.isDefault);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const parsedInitial = parseEuroToCents(balanceInput) ?? 0;
    await saveAccount({
      id: editing?.id,
      name: name.trim() || 'Conto',
      type,
      icon,
      color,
      initialBalanceCents: parsedInitial,
      includeInTotal,
      isDefault,
      archived: editing?.archived ?? false,
    });
    setModalOpen(false);
  };

  const handleAdjustSave = async () => {
    if (!adjustingAcc) return;
    const desired = parseEuroToCents(desiredBalanceStr);
    if (desired !== null) {
      await adjustAccountBalance(adjustingAcc.id, desired);
    }
    setAdjustingAcc(null);
  };

  const allNetWorthCents = activeAccounts.reduce(
    (sum, a) => sum + (accountBalances[a.id] ?? 0),
    0
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-20 space-y-4">
      {/* Summary Header Card */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 text-white rounded-3xl p-5 shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-200/80 font-semibold">
              Saldo incluso nel totale
            </p>
            <p className="text-3xl font-extrabold tabular-nums mt-0.5">
              {formatEuro(totalBalanceCents)}
            </p>
            {allNetWorthCents !== totalBalanceCents && (
              <p className="text-xs text-emerald-200/80 mt-1">
                Patrimonio complessivo (tutti i conti):{' '}
                <strong>{formatEuro(allNetWorthCents)}</strong>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenTransfer({ kind: 'transfer' })}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-300" />
              Trasferisci
            </button>
          </div>
        </div>
      </div>

      {/* Active Accounts List */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Conti Attivi ({activeAccounts.length})
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Aggiungi conto
        </button>
      </div>

      <div className="space-y-2.5">
        {activeAccounts.map((acc, idx) => {
          const curBal = accountBalances[acc.id] ?? 0;
          return (
            <div
              key={acc.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0"
                    style={{ backgroundColor: acc.color }}
                  >
                    <DynamicIcon name={acc.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {acc.name}
                      </h3>
                      {acc.isDefault && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Predefinito
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>
                        {ACCOUNT_TYPES.find((t) => t.id === acc.type)?.label ??
                          'Conto'}
                      </span>
                      {!acc.includeInTotal && (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <EyeOff className="w-3 h-3" /> Escluso dal totale
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatEuro(curBal)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div className="flex items-center gap-1">
                  {activeAccounts.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveAccountOrder(acc.id, -1)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === activeAccounts.length - 1}
                        onClick={() => moveAccountOrder(acc.id, 1)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustingAcc(acc);
                      setDesiredBalanceStr(centsToInputString(curBal) || '0');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
                    Rettifica saldo
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(acc)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifica
                  </button>
                  {activeAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        saveAccount({
                          id: acc.id,
                          name: acc.name,
                          type: acc.type,
                          icon: acc.icon,
                          color: acc.color,
                          initialBalanceCents: acc.initialBalanceCents,
                          includeInTotal: acc.includeInTotal,
                          isDefault: false,
                          archived: true,
                        })
                      }
                      title="Archivia conto"
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Accounts */}
      {archivedAccounts.length > 0 && (
        <div className="pt-3 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Conti Archiviati ({archivedAccounts.length})
          </h3>
          {archivedAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl px-4 py-3 flex items-center justify-between opacity-75"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {acc.name}
                </p>
                <p className="text-xs text-slate-400">
                  Saldo: {formatEuro(accountBalances[acc.id] ?? 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    saveAccount({
                      id: acc.id,
                      name: acc.name,
                      type: acc.type,
                      icon: acc.icon,
                      color: acc.color,
                      initialBalanceCents: acc.initialBalanceCents,
                      includeInTotal: acc.includeInTotal,
                      isDefault: false,
                      archived: false,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold flex items-center gap-1"
                >
                  <ArchiveRestore className="w-3.5 h-3.5 text-emerald-500" />
                  Ripristina
                </button>
                <button
                  type="button"
                  onClick={() => deleteAccount(acc.id)}
                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Account Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Modifica Conto' : 'Nuovo Conto'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nome del conto
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Conto Principale, Contanti, Revolut..."
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Tipologia
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as Account['type'];
                      setType(nextType);
                      const def = ACCOUNT_TYPES.find((t) => t.id === nextType);
                      if (def) setIcon(def.defaultIcon);
                    }}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Saldo iniziale (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Colore
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition ${
                        color === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Includi nel Saldo Totale
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Disattiva per risparmi che non vuoi sommare alla liquidità
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={includeInTotal}
                  onChange={(e) => setIncludeInTotal(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Conto predefinito
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Selezionato automaticamente quando premi +
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              {editing && activeAccounts.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteAccount(editing.id);
                    setModalOpen(false);
                  }}
                  className="px-3.5 py-3 rounded-2xl bg-rose-500/15 text-rose-500 text-xs font-bold"
                >
                  Elimina
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-sm"
              >
                Salva Conto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {adjustingAcc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAdjustingAcc(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Rettifica saldo · {adjustingAcc.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inserisci il saldo reale attuale del tuo conto in Euro. Il saldo iniziale verrà allineato automaticamente.
            </p>
            <input
              type="text"
              inputMode="decimal"
              value={desiredBalanceStr}
              onChange={(e) => setDesiredBalanceStr(e.target.value)}
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-lg font-extrabold tabular-nums text-slate-900 dark:text-white outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAdjustingAcc(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleAdjustSave}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
              >
                Aggiorna Saldo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
