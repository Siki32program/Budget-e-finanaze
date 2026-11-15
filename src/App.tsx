import React, { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AccountsView } from './components/AccountsView';
import { CategoriesView } from './components/CategoriesView';
import { HeaderBar } from './components/HeaderBar';
import { HomeDashboard } from './components/HomeDashboard';
import { ImportExportView } from './components/ImportExportView';
import { OperationsView } from './components/OperationsView';
import { PinLockScreen } from './components/PinLockScreen';
import { RecurringView } from './components/RecurringView';
import { SettingsView } from './components/SettingsView';
import { SideDrawer } from './components/SideDrawer';
import { StatsView } from './components/StatsView';
import { TransactionModal } from './components/TransactionModal';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import type {
  AppView,
  MainFlowTab,
  Transaction,
  TransactionKind,
} from './types/finance';

function SikiBudgetShell() {
  const { ready, isLocked, settings } = useFinance();

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [flowTab, setFlowTab] = useState<MainFlowTab>('expense');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txPreset, setTxPreset] = useState<{
    kind?: TransactionKind;
    categoryId?: string;
  } | null>(null);

  // Configure native Android StatusBar & Hardware Back Button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({
      color: settings.theme === 'dark' ? '#022c22' : '#065f46',
    }).catch(() => {});
  }, [settings.theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const subPromise = CapApp.addListener('backButton', () => {
      if (txModalOpen) {
        setTxModalOpen(false);
        return;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (currentView !== 'home') {
        setCurrentView('home');
        return;
      }
      CapApp.exitApp();
    });
    return () => {
      subPromise.then((s) => s.remove());
    };
  }, [txModalOpen, drawerOpen, currentView]);

  const openNewTransaction = (preset?: {
    kind?: TransactionKind;
    categoryId?: string;
  }) => {
    setEditingTx(null);
    setTxPreset(preset ?? { kind: flowTab });
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setTxPreset(null);
    setTxModalOpen(true);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-2xl font-extrabold text-amber-300 animate-pulse">
          €
        </div>
        <p className="text-xs font-medium text-slate-400">
          Avvio Siki Budget...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {isLocked && settings.pinCodeHash && <PinLockScreen />}

      <HeaderBar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <HomeDashboard
            flowTab={flowTab}
            onChangeFlowTab={setFlowTab}
            onOpenNewTransaction={openNewTransaction}
            onEditTransaction={openEditTransaction}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === 'operations' && (
          <OperationsView
            onOpenNewTransaction={openNewTransaction}
            onEditTransaction={openEditTransaction}
          />
        )}
        {currentView === 'accounts' && (
          <AccountsView onOpenTransfer={openNewTransaction} />
        )}
        {currentView === 'categories' && <CategoriesView />}
        {currentView === 'recurring' && <RecurringView />}
        {currentView === 'stats' && <StatsView />}
        {currentView === 'import_export' && <ImportExportView />}
        {currentView === 'settings' && <SettingsView />}
      </main>

      <SideDrawer
        open={drawerOpen}
        currentView={currentView}
        onClose={() => setDrawerOpen(false)}
        onNavigate={setCurrentView}
      />

      <TransactionModal
        open={txModalOpen}
        editingTransaction={editingTx}
        preset={txPreset}
        onClose={() => setTxModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <SikiBudgetShell />
    </FinanceProvider>
  );
}
