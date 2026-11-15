import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { db, loadLocalSettings, queueOutbox, saveLocalSettings } from '../lib/db';
import {
  CURRENT_SEED_VERSION,
  createInitialSeedData,
  generateUUID,
  inferCategoryAppearance,
} from '../lib/defaults';
import { advanceRecurringDate, todayISO } from '../lib/format';
import { supabase } from '../lib/supabase';
import { runCloudSync } from '../lib/sync';
import type {
  Account,
  AppSettings,
  Category,
  PeriodSelection,
  RecurringRule,
  Transaction,
  TransactionKind,
} from '../types/finance';

export interface SaveTransactionInput {
  id?: string;
  kind: TransactionKind;
  amountCents: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  occurredOn: string;
  note: string;
}

export interface SaveAccountInput {
  id?: string;
  name: string;
  type: Account['type'];
  icon: string;
  color: string;
  initialBalanceCents: number;
  includeInTotal: boolean;
  isDefault: boolean;
  archived?: boolean;
}

export interface SaveCategoryInput {
  id?: string;
  parentId: string | null;
  kind: Category['kind'];
  name: string;
  icon: string;
  color: string;
  monthlyBudgetCents: number | null;
}

export interface SaveRecurringInput {
  id?: string;
  title: string;
  kind: TransactionKind;
  amountCents: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  frequency: RecurringRule['frequency'];
  nextDueOn: string;
  autoApply: boolean;
  active: boolean;
  note: string;
}

export interface ImportedTransactionRow {
  kind: TransactionKind;
  amountCents: number;
  occurredOn: string;
  categoryName?: string;
  subcategoryName?: string;
  accountName?: string;
  toAccountName?: string;
  note?: string;
}

interface FinanceContextValue {
  ready: boolean;
  accounts: Account[];
  activeAccounts: Account[];
  archivedAccounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  dueManualRules: RecurringRule[];
  accountBalances: Record<string, number>;
  totalBalanceCents: number;
  selectedAccountFilter: string; // 'all' or accountId
  setSelectedAccountFilter: (id: string) => void;
  displayedBalanceCents: number;
  period: PeriodSelection;
  setPeriod: React.Dispatch<React.SetStateAction<PeriodSelection>>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  isLocked: boolean;
  unlockApp: () => void;
  lockApp: () => void;

  // Cloud Auth & Sync
  cloudUser: User | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  syncError: string | null;
  pendingOutboxCount: number;
  signInCloud: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUpCloud: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOutCloud: () => Promise<void>;
  triggerSync: (forceFullPush?: boolean) => Promise<{ ok: boolean; error?: string }>;

  // CRUD
  saveTransaction: (input: SaveTransactionInput) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  saveAccount: (input: SaveAccountInput) => Promise<Account>;
  adjustAccountBalance: (accountId: string, desiredBalanceCents: number) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  moveAccountOrder: (id: string, direction: -1 | 1) => Promise<void>;
  saveCategory: (input: SaveCategoryInput) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  moveCategoryOrder: (id: string, direction: -1 | 1) => Promise<void>;
  saveRecurringRule: (input: SaveRecurringInput) => Promise<RecurringRule>;
  applyRecurringRuleNow: (ruleId: string) => Promise<void>;
  skipRecurringRuleOnce: (ruleId: string) => Promise<void>;
  deleteRecurringRule: (id: string) => Promise<void>;
  importTransactionsBatch: (
    rows: ImportedTransactionRow[],
    options?: { deduplicate?: boolean }
  ) => Promise<{ imported: number; skipped: number }>;
  exportBackupJSON: () => Promise<string>;
  restoreBackupJSON: (jsonText: string) => Promise<{ ok: boolean; error?: string }>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allRecurring, setAllRecurring] = useState<RecurringRule[]>([]);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);

  const [settings, setSettings] = useState<AppSettings>(() => loadLocalSettings());
  const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(loadLocalSettings().pinCodeHash));
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');

  const today = todayISO();
  const [period, setPeriod] = useState<PeriodSelection>(() => {
    const initialMode = loadLocalSettings().defaultPeriod || 'month';
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    return {
      mode: initialMode,
      anchorDate: today,
      customStart: firstOfMonth,
      customEnd: today,
    };
  });

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  >('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  // Apply light/dark theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const reloadFromIndexedDB = useCallback(async () => {
    const [accs, cats, txs, recs, outboxCount] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurringRules.toArray(),
      db.outbox.count(),
    ]);

    setAllAccounts(
      accs
        .filter((a) => !a.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    );
    setAllCategories(
      cats
        .filter((c) => !c.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    );
    setAllTransactions(
      txs
        .filter((t) => !t.deletedAt)
        .sort(
          (a, b) =>
            b.occurredOn.localeCompare(a.occurredOn) ||
            b.createdAt.localeCompare(a.createdAt)
        )
    );
    setAllRecurring(
      recs
        .filter((r) => !r.deletedAt)
        .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))
    );
    setPendingOutboxCount(outboxCount);
  }, []);

  const scheduleBackgroundSync = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      setSyncStatus('syncing');
      const res = await runCloudSync();
      if (res.ok) {
        setSyncStatus('synced');
        setSyncError(null);
        setSettings(loadLocalSettings());
        await reloadFromIndexedDB();
      } else {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        setSyncError(res.error ?? null);
      }
    }, 600);
  }, [reloadFromIndexedDB]);

  // Auto-process recurring rules that have autoApply = true and nextDueOn <= today
  const processAutoRecurringRules = useCallback(async () => {
    const nowDay = todayISO();
    const rules = (await db.recurringRules.toArray()).filter(
      (r) => !r.deletedAt && r.active && r.autoApply && r.nextDueOn <= nowDay
    );
    if (rules.length === 0) return;

    const nowISO = new Date().toISOString();
    for (const rule of rules) {
      let cursor = rule.nextDueOn;
      let guard = 0;
      while (cursor <= nowDay && guard < 36) {
        const tx: Transaction = {
          id: generateUUID(),
          kind: rule.kind,
          amountCents: rule.amountCents,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId,
          occurredOn: cursor,
          note: rule.note || `${rule.title} (automatico)`,
          recurringRuleId: rule.id,
          deletedAt: null,
          createdAt: nowISO,
          updatedAt: nowISO,
        };
        await db.transactions.put(tx);
        await queueOutbox('transactions', tx.id, nowISO);
        cursor = advanceRecurringDate(cursor, rule.frequency);
        guard++;
      }
      const updatedRule: RecurringRule = {
        ...rule,
        nextDueOn: cursor,
        updatedAt: nowISO,
      };
      await db.recurringRules.put(updatedRule);
      await queueOutbox('recurring_rules', updatedRule.id, nowISO);
    }
  }, []);

  // Initial DB seed + Auth listener
  useEffect(() => {
    let mounted = true;

    (async () => {
      const [existingAccCount, existingTxCount] = await Promise.all([
        db.accounts.count(),
        db.transactions.count(),
      ]);
      const localSet = loadLocalSettings();

      const shouldReseedUntouched =
        localSet.seededVersion < CURRENT_SEED_VERSION &&
        !localSet.hasUserModifiedData &&
        existingTxCount === 0 &&
        !localSet.lastSyncedAt;

      if (existingAccCount === 0 || shouldReseedUntouched) {
        const seed = createInitialSeedData();
        await db.transaction('rw', [db.accounts, db.categories], async () => {
          if (shouldReseedUntouched) {
            await db.accounts.clear();
            await db.categories.clear();
          }
          await db.accounts.bulkPut(seed.accounts);
          await db.categories.bulkPut(seed.categories);
        });
        const nextSet: AppSettings = {
          ...localSet,
          seededVersion: CURRENT_SEED_VERSION,
        };
        saveLocalSettings(nextSet);
        if (mounted) setSettings(nextSet);
      }

      await processAutoRecurringRules();
      await reloadFromIndexedDB();
      if (mounted) setReady(true);

      // Check existing Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted && session?.user) {
        setCloudUser(session.user);
        setSyncStatus('syncing');
        const res = await runCloudSync();
        if (mounted) {
          setSyncStatus(res.ok ? 'synced' : navigator.onLine ? 'error' : 'offline');
          setSyncError(res.error ?? null);
          setSettings(loadLocalSettings());
          await reloadFromIndexedDB();
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudUser(session?.user ?? null);
    });

    const onOnline = () => scheduleBackgroundSync();
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const cur = loadLocalSettings();
        if (cur.pinCodeHash && cur.pinLockOnBackground) {
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'visible') {
        scheduleBackgroundSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [processAutoRecurringRules, reloadFromIndexedDB, scheduleBackgroundSync]);

  const markUserModified = useCallback(() => {
    const cur = loadLocalSettings();
    if (!cur.hasUserModifiedData) {
      const updated = { ...cur, hasUserModifiedData: true };
      saveLocalSettings(updated);
      setSettings(updated);
    }
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const cur = loadLocalSettings();
      const next: AppSettings = { ...cur, ...patch };
      saveLocalSettings(next);
      setSettings(next);
      await queueOutbox('user_settings', 'singleton', new Date().toISOString());
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [reloadFromIndexedDB, scheduleBackgroundSync]
  );

  // Derived accounts & balances
  const activeAccounts = useMemo(
    () => allAccounts.filter((a) => !a.archived),
    [allAccounts]
  );
  const archivedAccounts = useMemo(
    () => allAccounts.filter((a) => a.archived),
    [allAccounts]
  );

  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const acc of allAccounts) {
      map[acc.id] = acc.initialBalanceCents;
    }
    for (const tx of allTransactions) {
      if (tx.kind === 'expense') {
        map[tx.accountId] = (map[tx.accountId] ?? 0) - tx.amountCents;
      } else if (tx.kind === 'income') {
        map[tx.accountId] = (map[tx.accountId] ?? 0) + tx.amountCents;
      } else if (tx.kind === 'transfer') {
        map[tx.accountId] = (map[tx.accountId] ?? 0) - tx.amountCents;
        if (tx.toAccountId) {
          map[tx.toAccountId] = (map[tx.toAccountId] ?? 0) + tx.amountCents;
        }
      }
    }
    return map;
  }, [allAccounts, allTransactions]);

  const totalBalanceCents = useMemo(() => {
    return activeAccounts
      .filter((a) => a.includeInTotal)
      .reduce((sum, a) => sum + (accountBalances[a.id] ?? 0), 0);
  }, [activeAccounts, accountBalances]);

  // Reset selectedAccountFilter if that account was archived/deleted
  useEffect(() => {
    if (
      selectedAccountFilter !== 'all' &&
      !activeAccounts.some((a) => a.id === selectedAccountFilter)
    ) {
      setSelectedAccountFilter('all');
    }
  }, [activeAccounts, selectedAccountFilter]);

  const displayedBalanceCents = useMemo(() => {
    if (selectedAccountFilter === 'all') return totalBalanceCents;
    return accountBalances[selectedAccountFilter] ?? 0;
  }, [selectedAccountFilter, totalBalanceCents, accountBalances]);

  const dueManualRules = useMemo(() => {
    const nowDay = todayISO();
    return allRecurring.filter((r) => r.active && !r.autoApply && r.nextDueOn <= nowDay);
  }, [allRecurring]);

  // Cloud Auth methods
  const triggerSync = useCallback(
    async (forceFullPush?: boolean) => {
      setSyncStatus('syncing');
      const res = await runCloudSync({ forceFullPush });
      if (res.ok) {
        setSyncStatus('synced');
        setSyncError(null);
        setSettings(loadLocalSettings());
        await reloadFromIndexedDB();
      } else {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        setSyncError(res.error ?? null);
      }
      return { ok: res.ok, error: res.error };
    },
    [reloadFromIndexedDB]
  );

  const signInCloud = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: error.message };
      setCloudUser(data.user);
      await triggerSync();
      return { ok: true };
    },
    [triggerSync]
  );

  const signUpCloud = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) return { ok: false, error: error.message };
      setCloudUser(data.user ?? null);
      if (data.session) {
        await triggerSync();
      }
      return { ok: true };
    },
    [triggerSync]
  );

  const signOutCloud = useCallback(async () => {
    await supabase.auth.signOut();
    setCloudUser(null);
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  // CRUD: Transactions
  const saveTransaction = useCallback(
    async (input: SaveTransactionInput): Promise<Transaction> => {
      const now = new Date().toISOString();
      const existing = input.id ? await db.transactions.get(input.id) : undefined;
      const tx: Transaction = {
        id: existing?.id ?? generateUUID(),
        kind: input.kind,
        amountCents: Math.max(0, Math.round(input.amountCents)),
        accountId: input.accountId,
        toAccountId: input.kind === 'transfer' ? input.toAccountId ?? null : null,
        categoryId: input.kind === 'transfer' ? null : input.categoryId ?? null,
        subcategoryId: input.kind === 'transfer' ? null : input.subcategoryId ?? null,
        occurredOn: input.occurredOn,
        note: input.note.trim(),
        recurringRuleId: existing?.recurringRuleId ?? null,
        deletedAt: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.transactions.put(tx);
      await queueOutbox('transactions', tx.id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
      return tx;
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const existing = await db.transactions.get(id);
      if (!existing) return;
      const now = new Date().toISOString();
      const updated: Transaction = { ...existing, deletedAt: now, updatedAt: now };
      await db.transactions.put(updated);
      await queueOutbox('transactions', id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  // CRUD: Accounts
  const saveAccount = useCallback(
    async (input: SaveAccountInput): Promise<Account> => {
      const now = new Date().toISOString();
      const existing = input.id ? await db.accounts.get(input.id) : undefined;
      const currentList = (await db.accounts.toArray()).filter((a) => !a.deletedAt);

      if (input.isDefault) {
        for (const other of currentList) {
          if (other.id !== existing?.id && other.isDefault) {
            const cleared = { ...other, isDefault: false, updatedAt: now };
            await db.accounts.put(cleared);
            await queueOutbox('accounts', cleared.id, now);
          }
        }
      }

      const acc: Account = {
        id: existing?.id ?? generateUUID(),
        name: input.name.trim() || 'Conto',
        type: input.type,
        icon: input.icon,
        color: input.color,
        initialBalanceCents: Math.round(input.initialBalanceCents),
        includeInTotal: input.includeInTotal,
        isDefault: currentList.length === 0 ? true : input.isDefault,
        archived: input.archived ?? existing?.archived ?? false,
        sortOrder: existing?.sortOrder ?? currentList.length,
        deletedAt: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.accounts.put(acc);
      await queueOutbox('accounts', acc.id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
      return acc;
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const adjustAccountBalance = useCallback(
    async (accountId: string, desiredBalanceCents: number) => {
      const acc = await db.accounts.get(accountId);
      if (!acc) return;
      const currentBal = accountBalances[accountId] ?? acc.initialBalanceCents;
      const delta = Math.round(desiredBalanceCents) - currentBal;
      if (delta === 0) return;
      const now = new Date().toISOString();
      const updated: Account = {
        ...acc,
        initialBalanceCents: acc.initialBalanceCents + delta,
        updatedAt: now,
      };
      await db.accounts.put(updated);
      await queueOutbox('accounts', acc.id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [accountBalances, markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const active = (await db.accounts.toArray()).filter((a) => !a.deletedAt);
      if (active.length <= 1) {
        throw new Error('Deve rimanere almeno un conto attivo.');
      }
      const existing = await db.accounts.get(id);
      if (!existing) return;
      const now = new Date().toISOString();
      await db.accounts.put({ ...existing, deletedAt: now, updatedAt: now });
      await queueOutbox('accounts', id, now);

      if (existing.isDefault) {
        const fallback = active.find((a) => a.id !== id);
        if (fallback) {
          await db.accounts.put({ ...fallback, isDefault: true, updatedAt: now });
          await queueOutbox('accounts', fallback.id, now);
        }
      }
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const moveAccountOrder = useCallback(
    async (id: string, direction: -1 | 1) => {
      const list = [...activeAccounts];
      const idx = list.findIndex((a) => a.id === id);
      const swapIdx = idx + direction;
      if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
      const now = new Date().toISOString();
      const [a, b] = [list[idx], list[swapIdx]];
      await db.accounts.put({ ...a, sortOrder: swapIdx, updatedAt: now });
      await db.accounts.put({ ...b, sortOrder: idx, updatedAt: now });
      await queueOutbox('accounts', a.id, now);
      await queueOutbox('accounts', b.id, now);
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [activeAccounts, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  // CRUD: Categories
  const saveCategory = useCallback(
    async (input: SaveCategoryInput): Promise<Category> => {
      const now = new Date().toISOString();
      const existing = input.id ? await db.categories.get(input.id) : undefined;
      const siblings = (await db.categories.toArray()).filter(
        (c) => !c.deletedAt && c.kind === input.kind && c.parentId === input.parentId
      );

      const cat: Category = {
        id: existing?.id ?? generateUUID(),
        parentId: input.parentId,
        kind: input.kind,
        name: input.name.trim() || 'Categoria',
        icon: input.icon,
        color: input.color,
        monthlyBudgetCents:
          input.monthlyBudgetCents && input.monthlyBudgetCents > 0
            ? Math.round(input.monthlyBudgetCents)
            : null,
        archived: existing?.archived ?? false,
        sortOrder: existing?.sortOrder ?? siblings.length,
        deletedAt: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.categories.put(cat);
      await queueOutbox('categories', cat.id, now);

      // Keep subcategories color synced if parent color changed
      if (!cat.parentId && existing && existing.color !== cat.color) {
        const subs = (await db.categories.toArray()).filter(
          (c) => !c.deletedAt && c.parentId === cat.id
        );
        for (const sub of subs) {
          const updatedSub = { ...sub, color: cat.color, updatedAt: now };
          await db.categories.put(updatedSub);
          await queueOutbox('categories', updatedSub.id, now);
        }
      }

      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
      return cat;
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const existing = await db.categories.get(id);
      if (!existing) return;
      const now = new Date().toISOString();
      await db.categories.put({ ...existing, deletedAt: now, updatedAt: now });
      await queueOutbox('categories', id, now);

      // Also soft-delete child subcategories if parent deleted
      const subs = (await db.categories.toArray()).filter(
        (c) => !c.deletedAt && c.parentId === id
      );
      for (const s of subs) {
        await db.categories.put({ ...s, deletedAt: now, updatedAt: now });
        await queueOutbox('categories', s.id, now);
      }

      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const moveCategoryOrder = useCallback(
    async (id: string, direction: -1 | 1) => {
      const target = allCategories.find((c) => c.id === id);
      if (!target) return;
      const siblings = allCategories.filter(
        (c) => c.kind === target.kind && c.parentId === target.parentId
      );
      const idx = siblings.findIndex((c) => c.id === id);
      const swapIdx = idx + direction;
      if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return;
      const now = new Date().toISOString();
      const [a, b] = [siblings[idx], siblings[swapIdx]];
      await db.categories.put({ ...a, sortOrder: swapIdx, updatedAt: now });
      await db.categories.put({ ...b, sortOrder: idx, updatedAt: now });
      await queueOutbox('categories', a.id, now);
      await queueOutbox('categories', b.id, now);
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [allCategories, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  // CRUD: Recurring rules
  const saveRecurringRule = useCallback(
    async (input: SaveRecurringInput): Promise<RecurringRule> => {
      const now = new Date().toISOString();
      const existing = input.id ? await db.recurringRules.get(input.id) : undefined;
      const rule: RecurringRule = {
        id: existing?.id ?? generateUUID(),
        title: input.title.trim() || 'Pagamento ricorrente',
        kind: input.kind,
        amountCents: Math.max(0, Math.round(input.amountCents)),
        accountId: input.accountId,
        toAccountId: input.kind === 'transfer' ? input.toAccountId ?? null : null,
        categoryId: input.kind === 'transfer' ? null : input.categoryId ?? null,
        subcategoryId: input.kind === 'transfer' ? null : input.subcategoryId ?? null,
        frequency: input.frequency,
        nextDueOn: input.nextDueOn,
        autoApply: input.autoApply,
        active: input.active,
        note: input.note.trim(),
        deletedAt: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.recurringRules.put(rule);
      await queueOutbox('recurring_rules', rule.id, now);
      markUserModified();
      await processAutoRecurringRules();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
      return rule;
    },
    [markUserModified, processAutoRecurringRules, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const applyRecurringRuleNow = useCallback(
    async (ruleId: string) => {
      const rule = await db.recurringRules.get(ruleId);
      if (!rule) return;
      const now = new Date().toISOString();
      const tx: Transaction = {
        id: generateUUID(),
        kind: rule.kind,
        amountCents: rule.amountCents,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        categoryId: rule.categoryId,
        subcategoryId: rule.subcategoryId,
        occurredOn: rule.nextDueOn,
        note: rule.note || rule.title,
        recurringRuleId: rule.id,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const nextDate = advanceRecurringDate(rule.nextDueOn, rule.frequency);
      await db.transactions.put(tx);
      await db.recurringRules.put({ ...rule, nextDueOn: nextDate, updatedAt: now });
      await queueOutbox('transactions', tx.id, now);
      await queueOutbox('recurring_rules', rule.id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const skipRecurringRuleOnce = useCallback(
    async (ruleId: string) => {
      const rule = await db.recurringRules.get(ruleId);
      if (!rule) return;
      const now = new Date().toISOString();
      const nextDate = advanceRecurringDate(rule.nextDueOn, rule.frequency);
      await db.recurringRules.put({ ...rule, nextDueOn: nextDate, updatedAt: now });
      await queueOutbox('recurring_rules', rule.id, now);
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [reloadFromIndexedDB, scheduleBackgroundSync]
  );

  const deleteRecurringRule = useCallback(
    async (id: string) => {
      const existing = await db.recurringRules.get(id);
      if (!existing) return;
      const now = new Date().toISOString();
      await db.recurringRules.put({ ...existing, deletedAt: now, updatedAt: now });
      await queueOutbox('recurring_rules', id, now);
      markUserModified();
      await reloadFromIndexedDB();
      scheduleBackgroundSync();
    },
    [markUserModified, reloadFromIndexedDB, scheduleBackgroundSync]
  );

  // Batch Import (100% compatible with "Budget e finanze.xlsx" & generic Excel/CSV)
  const importTransactionsBatch = useCallback(
    async (rows: ImportedTransactionRow[], options?: { deduplicate?: boolean }) => {
      const deduplicate = options?.deduplicate !== false;
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const accList = [...activeAccounts];
      const defaultAcc = accList.find((a) => a.isDefault) || accList[0];
      if (!defaultAcc) throw new Error('Nessun conto disponibile.');

      const catList = [...allCategories];
      const catById = new Map(catList.map((c) => [c.id, c]));

      // Build multiset of existing transaction signatures for optional deduplication
      const existingCounts = new Map<string, number>();
      if (deduplicate) {
        for (const tx of allTransactions) {
          const catName = tx.categoryId
            ? (catById.get(tx.categoryId)?.name ?? '').trim().toLowerCase()
            : '';
          const sig = `${tx.kind}|${tx.occurredOn}|${tx.amountCents}|${catName}|${tx.note
            .trim()
            .toLowerCase()}`;
          existingCounts.set(sig, (existingCounts.get(sig) ?? 0) + 1);
        }
      }

      const findOrCreateAccount = async (rawName?: string): Promise<Account> => {
        const trimmed = (rawName ?? '').trim();
        if (!trimmed) return defaultAcc;
        const found = accList.find(
          (a) => a.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (found) return found;
        const created: Account = {
          id: generateUUID(),
          name: trimmed,
          type: 'bank',
          icon: 'landmark',
          color: '#10b981',
          initialBalanceCents: 0,
          includeInTotal: true,
          isDefault: false,
          archived: false,
          sortOrder: accList.length,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        accList.push(created);
        await db.accounts.put(created);
        await queueOutbox('accounts', created.id, now);
        return created;
      };

      const findOrCreateCategory = async (
        kind: 'expense' | 'income',
        catName?: string,
        subName?: string
      ): Promise<{ categoryId: string; subcategoryId: string | null }> => {
        const cleanCat = (catName ?? '').trim() || 'Altro';
        let parent = catList.find(
          (c) =>
            c.kind === kind &&
            !c.parentId &&
            c.name.toLowerCase() === cleanCat.toLowerCase()
        );
        if (!parent) {
          const appearance = inferCategoryAppearance(kind, cleanCat);
          parent = {
            id: generateUUID(),
            parentId: null,
            kind,
            name: cleanCat,
            icon: appearance.icon,
            color: appearance.color,
            monthlyBudgetCents: null,
            archived: false,
            sortOrder: catList.filter((c) => c.kind === kind && !c.parentId).length,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          catList.push(parent);
          catById.set(parent.id, parent);
          await db.categories.put(parent);
          await queueOutbox('categories', parent.id, now);
        }

        const cleanSub = (subName ?? '').trim();
        if (!cleanSub) {
          return { categoryId: parent.id, subcategoryId: null };
        }

        let sub = catList.find(
          (c) =>
            c.kind === kind &&
            c.parentId === parent!.id &&
            c.name.toLowerCase() === cleanSub.toLowerCase()
        );
        if (!sub) {
          sub = {
            id: generateUUID(),
            parentId: parent.id,
            kind,
            name: cleanSub,
            icon: parent.icon,
            color: parent.color,
            monthlyBudgetCents: null,
            archived: false,
            sortOrder: catList.filter((c) => c.parentId === parent!.id).length,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          catList.push(sub);
          catById.set(sub.id, sub);
          await db.categories.put(sub);
          await queueOutbox('categories', sub.id, now);
        }
        return { categoryId: parent.id, subcategoryId: sub.id };
      };

      const createdTxs: Transaction[] = [];
      let skipped = 0;

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const roundedCents = Math.round(r.amountCents || 0);
        if (roundedCents <= 0) continue;

        const cleanCatLower =
          r.kind === 'transfer'
            ? ''
            : ((r.categoryName ?? '').trim() || 'Altro').toLowerCase();
        const cleanNote = (r.note ?? '').trim();
        const sig = `${r.kind}|${r.occurredOn}|${roundedCents}|${cleanCatLower}|${cleanNote.toLowerCase()}`;

        if (deduplicate) {
          const rem = existingCounts.get(sig) ?? 0;
          if (rem > 0) {
            existingCounts.set(sig, rem - 1);
            skipped++;
            continue;
          }
        }

        const fromAcc = await findOrCreateAccount(r.accountName);
        let toAccountId: string | null = null;
        let categoryId: string | null = null;
        let subcategoryId: string | null = null;

        if (r.kind === 'transfer') {
          const toAcc = await findOrCreateAccount(r.toAccountName || 'Conto Secondario');
          toAccountId = toAcc.id;
        } else {
          const catIds = await findOrCreateCategory(
            r.kind,
            r.categoryName,
            r.subcategoryName
          );
          categoryId = catIds.categoryId;
          subcategoryId = catIds.subcategoryId;
        }

        // Preserve top-to-bottom spreadsheet order within the same day
        const createdAt = new Date(nowMs - idx * 10).toISOString();

        createdTxs.push({
          id: generateUUID(),
          kind: r.kind,
          amountCents: roundedCents,
          accountId: fromAcc.id,
          toAccountId,
          categoryId,
          subcategoryId,
          occurredOn: r.occurredOn,
          note: cleanNote,
          recurringRuleId: null,
          deletedAt: null,
          createdAt,
          updatedAt: now,
        });
      }

      if (createdTxs.length > 0) {
        await db.transactions.bulkPut(createdTxs);
        await db.outbox.bulkPut(
          createdTxs.map((t) => ({
            id: `transactions:${t.id}`,
            table: 'transactions' as const,
            recordId: t.id,
            updatedAt: now,
          }))
        );
        markUserModified();
        await reloadFromIndexedDB();
        scheduleBackgroundSync();
      }

      return { imported: createdTxs.length, skipped };
    },
    [
      activeAccounts,
      allCategories,
      allTransactions,
      markUserModified,
      reloadFromIndexedDB,
      scheduleBackgroundSync,
    ]
  );

  const exportBackupJSON = useCallback(async () => {
    const [accounts, categories, transactions, recurringRules] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurringRules.toArray(),
    ]);
    return JSON.stringify(
      {
        app: 'Siki Budget',
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: accounts.filter((a) => !a.deletedAt),
        categories: categories.filter((c) => !c.deletedAt),
        transactions: transactions.filter((t) => !t.deletedAt),
        recurringRules: recurringRules.filter((r) => !r.deletedAt),
      },
      null,
      2
    );
  }, []);

  const restoreBackupJSON = useCallback(
    async (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.categories)) {
          return { ok: false, error: 'Formato file di backup non valido.' };
        }
        const now = new Date().toISOString();
        await db.transaction(
          'rw',
          [db.accounts, db.categories, db.transactions, db.recurringRules, db.outbox],
          async () => {
            await db.accounts.clear();
            await db.categories.clear();
            await db.transactions.clear();
            await db.recurringRules.clear();
            await db.outbox.clear();

            await db.accounts.bulkPut(parsed.accounts);
            await db.categories.bulkPut(parsed.categories);
            if (Array.isArray(parsed.transactions)) {
              await db.transactions.bulkPut(parsed.transactions);
            }
            if (Array.isArray(parsed.recurringRules)) {
              await db.recurringRules.bulkPut(parsed.recurringRules);
            }
          }
        );
        markUserModified();
        await reloadFromIndexedDB();
        if (cloudUser) {
          await triggerSync(true);
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Impossibile leggere il backup JSON',
        };
      }
    },
    [cloudUser, markUserModified, reloadFromIndexedDB, triggerSync]
  );

  const value: FinanceContextValue = {
    ready,
    accounts: allAccounts,
    activeAccounts,
    archivedAccounts,
    categories: allCategories,
    transactions: allTransactions,
    recurringRules: allRecurring,
    dueManualRules,
    accountBalances,
    totalBalanceCents,
    selectedAccountFilter,
    setSelectedAccountFilter,
    displayedBalanceCents,
    period,
    setPeriod,
    settings,
    updateSettings,
    isLocked,
    unlockApp: () => setIsLocked(false),
    lockApp: () => {
      if (settings.pinCodeHash) setIsLocked(true);
    },
    cloudUser,
    syncStatus,
    syncError,
    pendingOutboxCount,
    signInCloud,
    signUpCloud,
    signOutCloud,
    triggerSync,
    saveTransaction,
    deleteTransaction,
    saveAccount,
    adjustAccountBalance,
    deleteAccount,
    moveAccountOrder,
    saveCategory,
    deleteCategory,
    moveCategoryOrder,
    saveRecurringRule,
    applyRecurringRuleNow,
    skipRecurringRuleOnce,
    deleteRecurringRule,
    importTransactionsBatch,
    exportBackupJSON,
    restoreBackupJSON,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
