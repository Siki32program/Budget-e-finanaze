import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { sha256Pin } from '../lib/format';
import type { PeriodMode } from '../types/finance';

export function SettingsView() {
  const {
    settings,
    updateSettings,
    cloudUser,
    syncStatus,
    syncError,
    pendingOutboxCount,
    signInCloud,
    signUpCloud,
    signOutCloud,
    triggerSync,
  } = useFinance();

  // Cloud Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(() =>
    settings.lastSyncedAt ? 'signin' : 'signup'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // PIN Setup State
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    if (!email.trim() || password.length < 6) {
      setAuthMsg({
        type: 'err',
        text: 'Inserisci una email valida e una password di almeno 6 caratteri.',
      });
      return;
    }
    setAuthBusy(true);
    const res =
      authMode === 'signin'
        ? await signInCloud(email, password)
        : await signUpCloud(email, password);
    setAuthBusy(false);

    if (res.ok) {
      setAuthMsg({
        type: 'ok',
        text:
          authMode === 'signup'
            ? 'Account privato creato e sincronizzato su Supabase (budget-finanze)!'
            : 'Accesso effettuato e dati sincronizzati!',
      });
      setPassword('');
    } else {
      setAuthMsg({
        type: 'err',
        text: res.error || 'Errore di autenticazione',
      });
    }
  };

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError('Il PIN deve essere composto esattamente da 4 cifre numeriche.');
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('I due PIN non coincidono.');
      return;
    }
    const hash = await sha256Pin(pinInput);
    await updateSettings({ pinCodeHash: hash });
    setPinInput('');
    setPinConfirm('');
    setPinError(null);
    setPinModal(false);
  };

  const handleDisablePin = async () => {
    await updateSettings({ pinCodeHash: null });
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Supabase Private Cloud Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Cloud Privato Supabase (budget-finanze)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Funziona sempre offline sul telefono e sincronizza automaticamente il tuo storico 2026 (&ldquo;Budget e finanze&rdquo;) su Supabase in Europa.
            </p>
          </div>
        </div>

        {cloudUser ? (
          <div className="space-y-3 pt-1">
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Connesso: {cloudUser.email}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {pendingOutboxCount > 0
                    ? `${pendingOutboxCount} in coda`
                    : 'Allineato'}
                </span>
              </div>
              {settings.lastSyncedAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ultima sincronizzazione:{' '}
                  {new Date(settings.lastSyncedAt).toLocaleString('it-IT')}
                </p>
              )}
              {syncError && (
                <p className="text-[11px] text-rose-500">Nota rete: {syncError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={syncStatus === 'syncing'}
                onClick={() => triggerSync()}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    syncStatus === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                Sincronizza Ora
              </button>
              <button
                type="button"
                onClick={signOutCloud}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                Esci
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCloudAuth} className="space-y-3 pt-1">
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`py-1.5 rounded-lg text-xs font-bold ${
                  authMode === 'signin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Accedi
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`py-1.5 rounded-lg text-xs font-bold ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Primo Accesso (Crea)
              </button>
            </div>

            {authMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium ${
                  authMsg.type === 'ok'
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-rose-500/15 text-rose-500'
                }`}
              >
                {authMsg.text}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="La tua email privata"
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 caratteri)"
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none"
            />

            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-3 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold text-xs"
            >
              {authBusy
                ? 'Connessione in corso...'
                : authMode === 'signup'
                ? 'Crea Account Privato & Sincronizza'
                : 'Accedi al Cloud'}
            </button>
          </form>
        )}
      </div>

      {/* Security PIN Lock Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Blocco Sicurezza con PIN (4 cifre)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {settings.pinCodeHash
                  ? 'Attivo: richiesto ad ogni apertura dell’app.'
                  : 'Disattivato: chiunque abbia il telefono sbloccato può aprire l’app.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setPinInput('');
              setPinConfirm('');
              setPinError(null);
              setPinModal(true);
            }}
            className="flex-1 py-2.5 rounded-2xl bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            {settings.pinCodeHash ? 'Cambia PIN' : 'Imposta PIN a 4 cifre'}
          </button>
          {settings.pinCodeHash && (
            <button
              type="button"
              onClick={handleDisablePin}
              className="px-4 py-2.5 rounded-2xl bg-rose-500/15 text-rose-500 text-xs font-bold"
            >
              Rimuovi PIN
            </button>
          )}
        </div>

        {settings.pinCodeHash && (
          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Richiedi PIN anche quando l&apos;app passa in secondo piano
            </span>
            <input
              type="checkbox"
              checked={settings.pinLockOnBackground}
              onChange={(e) =>
                updateSettings({ pinLockOnBackground: e.target.checked })
              }
              className="w-4 h-4 accent-emerald-500"
            />
          </label>
        )}
      </div>

      {/* Display & Preferences Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Aspetto & Preferenze
        </h3>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tema dell&apos;applicazione
          </span>
          <button
            type="button"
            onClick={() =>
              updateSettings({
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            {settings.theme === 'dark' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" /> Scuro
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Chiaro
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Vista predefinita all&apos;avvio
          </span>
          <select
            value={settings.defaultPeriod}
            onChange={(e) =>
              updateSettings({ defaultPeriod: e.target.value as PeriodMode })
            }
            className="rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            <option value="day">Giorno</option>
            <option value="week">Settimana</option>
            <option value="month">Mese (dal giorno 1)</option>
            <option value="year">Anno</option>
          </select>
        </div>

        <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Raggruppa categorie minori (&lt;3%) nel grafico
            </p>
            <p className="text-[11px] text-slate-400">
              Mantiene il grafico ad anello più pulito quando ci sono tante voci
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.groupSmallCategories}
            onChange={(e) =>
              updateSettings({ groupSmallCategories: e.target.checked })
            }
            className="w-4 h-4 accent-emerald-500"
          />
        </label>
      </div>

      {/* Android APK Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Smartphone className="w-4 h-4 text-emerald-500" />
          Installazione su Android (Siki Budget)
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Ogni modifica salvata su GitHub genera in automatico il pacchetto{' '}
          <strong className="text-slate-700 dark:text-slate-200">
            Siki-Budget.apk
          </strong>{' '}
          nella scheda <em>Actions / Releases</em> del tuo repository GitHub: ti basta scaricarlo dal telefono Android e toccare <strong>Installa</strong>.
        </p>
      </div>

      {/* PIN Setup Modal */}
      {pinModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPinModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Configura PIN a 4 cifre
            </h3>
            {pinError && (
              <p className="text-xs text-rose-500 font-medium">{pinError}</p>
            )}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Nuovo PIN (4 cifre)"
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-center tracking-[0.5em] text-lg font-extrabold text-slate-900 dark:text-white outline-none"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="Conferma PIN"
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-center tracking-[0.5em] text-lg font-extrabold text-slate-900 dark:text-white outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPinModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold"
              >
                Attiva PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
