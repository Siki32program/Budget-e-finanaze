import { db, loadLocalSettings, saveLocalSettings } from './db';
import { supabase } from './supabase';
import type {
  Account,
  Category,
  RecurringRule,
  Transaction,
} from '../types/finance';

// Helpers to convert CamelCase <-> snake_case for PostgreSQL tables
function accountToRow(a: Account, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    name: a.name,
    type: a.type,
    icon: a.icon,
    color: a.color,
    initial_balance_cents: a.initialBalanceCents,
    include_in_total: a.includeInTotal,
    is_default: a.isDefault,
    archived: a.archived,
    sort_order: a.sortOrder,
    deleted_at: a.deletedAt,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    name: String(r.name ?? 'Conto'),
    type: (r.type as Account['type']) || 'bank',
    icon: String(r.icon ?? 'wallet'),
    color: String(r.color ?? '#10b981'),
    initialBalanceCents: Number(r.initial_balance_cents ?? 0),
    includeInTotal: Boolean(r.include_in_total ?? true),
    isDefault: Boolean(r.is_default ?? false),
    archived: Boolean(r.archived ?? false),
    sortOrder: Number(r.sort_order ?? 0),
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

function categoryToRow(c: Category, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    parent_id: c.parentId,
    kind: c.kind,
    name: c.name,
    icon: c.icon,
    color: c.color,
    monthly_budget_cents: c.monthlyBudgetCents,
    archived: c.archived,
    sort_order: c.sortOrder,
    deleted_at: c.deletedAt,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function rowToCategory(r: Record<string, unknown>): Category {
  return {
    id: String(r.id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    kind: (r.kind as Category['kind']) || 'expense',
    name: String(r.name ?? 'Categoria'),
    icon: String(r.icon ?? 'tag'),
    color: String(r.color ?? '#3b82f6'),
    monthlyBudgetCents:
      r.monthly_budget_cents !== null && r.monthly_budget_cents !== undefined
        ? Number(r.monthly_budget_cents)
        : null,
    archived: Boolean(r.archived ?? false),
    sortOrder: Number(r.sort_order ?? 0),
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

function transactionToRow(t: Transaction, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    kind: t.kind,
    amount_cents: t.amountCents,
    account_id: t.accountId,
    to_account_id: t.toAccountId,
    category_id: t.categoryId,
    subcategory_id: t.subcategoryId,
    occurred_on: t.occurredOn,
    note: t.note,
    recurring_rule_id: t.recurringRuleId,
    deleted_at: t.deletedAt,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function rowToTransaction(r: Record<string, unknown>): Transaction {
  return {
    id: String(r.id),
    kind: (r.kind as Transaction['kind']) || 'expense',
    amountCents: Number(r.amount_cents ?? 0),
    accountId: String(r.account_id ?? ''),
    toAccountId: r.to_account_id ? String(r.to_account_id) : null,
    categoryId: r.category_id ? String(r.category_id) : null,
    subcategoryId: r.subcategory_id ? String(r.subcategory_id) : null,
    occurredOn: String(r.occurred_on ?? '').slice(0, 10),
    note: String(r.note ?? ''),
    recurringRuleId: r.recurring_rule_id ? String(r.recurring_rule_id) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

function recurringToRow(rr: RecurringRule, userId: string) {
  return {
    id: rr.id,
    user_id: userId,
    title: rr.title,
    kind: rr.kind,
    amount_cents: rr.amountCents,
    account_id: rr.accountId,
    to_account_id: rr.toAccountId,
    category_id: rr.categoryId,
    subcategory_id: rr.subcategoryId,
    frequency: rr.frequency,
    next_due_on: rr.nextDueOn,
    auto_apply: rr.autoApply,
    active: rr.active,
    note: rr.note,
    deleted_at: rr.deletedAt,
    created_at: rr.createdAt,
    updated_at: rr.updatedAt,
  };
}

function rowToRecurring(r: Record<string, unknown>): RecurringRule {
  return {
    id: String(r.id),
    title: String(r.title ?? 'Ricorrente'),
    kind: (r.kind as RecurringRule['kind']) || 'expense',
    amountCents: Number(r.amount_cents ?? 0),
    accountId: String(r.account_id ?? ''),
    toAccountId: r.to_account_id ? String(r.to_account_id) : null,
    categoryId: r.category_id ? String(r.category_id) : null,
    subcategoryId: r.subcategory_id ? String(r.subcategory_id) : null,
    frequency: (r.frequency as RecurringRule['frequency']) || 'monthly',
    nextDueOn: String(r.next_due_on ?? '').slice(0, 10),
    autoApply: Boolean(r.auto_apply ?? true),
    active: Boolean(r.active ?? true),
    note: String(r.note ?? ''),
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

let syncInProgress = false;

export interface SyncOutcome {
  ok: boolean;
  error?: string;
  syncedAt?: string;
}

export async function runCloudSync(options?: {
  forceFullPush?: boolean;
}): Promise<SyncOutcome> {
  if (syncInProgress) return { ok: true };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'Dispositivo offline' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { ok: false, error: 'Non autenticato' };
  }

  syncInProgress = true;
  const userId = session.user.id;

  try {
    // Step 1: Check whether cloud already has data vs local untouched seed
    const settings = loadLocalSettings();
    const { count: remoteAccountCount, error: countErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    const cloudHasData = (remoteAccountCount ?? 0) > 0;
    const localTxCount = await db.transactions.count();

    if (cloudHasData && !settings.hasUserModifiedData && localTxCount === 0 && !settings.lastSyncedAt) {
      // Fresh device logging into an already-populated cloud account:
      // Clear local untouched default seed so we don't duplicate accounts/categories!
      await db.transaction('rw', [db.accounts, db.categories, db.outbox], async () => {
        await db.accounts.clear();
        await db.categories.clear();
        await db.outbox.clear();
      });
    } else if (!cloudHasData || options?.forceFullPush) {
      // First-time cloud sync: queue all local records to upload cleanly
      const [allAcc, allCat, allTx, allRec] = await Promise.all([
        db.accounts.toArray(),
        db.categories.toArray(),
        db.transactions.toArray(),
        db.recurringRules.toArray(),
      ]);

      if (allAcc.length > 0) {
        const { error } = await supabase
          .from('accounts')
          .upsert(allAcc.map((a) => accountToRow(a, userId)));
        if (error) throw error;
      }
      if (allCat.length > 0) {
        const { error } = await supabase
          .from('categories')
          .upsert(allCat.map((c) => categoryToRow(c, userId)));
        if (error) throw error;
      }
      if (allTx.length > 0) {
        // Chunk in batches of 500 for large Excel imports
        for (let i = 0; i < allTx.length; i += 500) {
          const chunk = allTx.slice(i, i + 500);
          const { error } = await supabase
            .from('transactions')
            .upsert(chunk.map((t) => transactionToRow(t, userId)));
          if (error) throw error;
        }
      }
      if (allRec.length > 0) {
        const { error } = await supabase
          .from('recurring_rules')
          .upsert(allRec.map((r) => recurringToRow(r, userId)));
        if (error) throw error;
      }
      await db.outbox.clear();
    }

    // Step 2: Push pending outbox items
    const outboxItems = await db.outbox.toArray();
    if (outboxItems.length > 0) {
      const byTable = {
        accounts: outboxItems.filter((o) => o.table === 'accounts'),
        categories: outboxItems.filter((o) => o.table === 'categories'),
        transactions: outboxItems.filter((o) => o.table === 'transactions'),
        recurring_rules: outboxItems.filter((o) => o.table === 'recurring_rules'),
        user_settings: outboxItems.filter((o) => o.table === 'user_settings'),
      };

      if (byTable.accounts.length > 0) {
        const records = (
          await db.accounts.bulkGet(byTable.accounts.map((o) => o.recordId))
        ).filter((x): x is Account => Boolean(x));
        if (records.length > 0) {
          const { error } = await supabase
            .from('accounts')
            .upsert(records.map((r) => accountToRow(r, userId)));
          if (error) throw error;
        }
        await db.outbox.bulkDelete(byTable.accounts.map((o) => o.id));
      }

      if (byTable.categories.length > 0) {
        const records = (
          await db.categories.bulkGet(byTable.categories.map((o) => o.recordId))
        ).filter((x): x is Category => Boolean(x));
        if (records.length > 0) {
          const { error } = await supabase
            .from('categories')
            .upsert(records.map((r) => categoryToRow(r, userId)));
          if (error) throw error;
        }
        await db.outbox.bulkDelete(byTable.categories.map((o) => o.id));
      }

      if (byTable.transactions.length > 0) {
        const records = (
          await db.transactions.bulkGet(byTable.transactions.map((o) => o.recordId))
        ).filter((x): x is Transaction => Boolean(x));
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500);
          const { error } = await supabase
            .from('transactions')
            .upsert(chunk.map((r) => transactionToRow(r, userId)));
          if (error) throw error;
        }
        await db.outbox.bulkDelete(byTable.transactions.map((o) => o.id));
      }

      if (byTable.recurring_rules.length > 0) {
        const records = (
          await db.recurringRules.bulkGet(byTable.recurring_rules.map((o) => o.recordId))
        ).filter((x): x is RecurringRule => Boolean(x));
        if (records.length > 0) {
          const { error } = await supabase
            .from('recurring_rules')
            .upsert(records.map((r) => recurringToRow(r, userId)));
          if (error) throw error;
        }
        await db.outbox.bulkDelete(byTable.recurring_rules.map((o) => o.id));
      }

      if (byTable.user_settings.length > 0) {
        const cur = loadLocalSettings();
        const { error } = await supabase.from('user_settings').upsert({
          user_id: userId,
          theme: cur.theme,
          group_small_categories: cur.groupSmallCategories,
          default_period: cur.defaultPeriod,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        await db.outbox.bulkDelete(byTable.user_settings.map((o) => o.id));
      }
    }

    // Step 3: Pull remote rows and merge via updated_at (Last-Write-Wins)
    const [accRes, catRes, txRes, recRes] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('recurring_rules').select('*'),
    ]);

    if (accRes.error) throw accRes.error;
    if (catRes.error) throw catRes.error;
    if (txRes.error) throw txRes.error;
    if (recRes.error) throw recRes.error;

    await db.transaction(
      'rw',
      [db.accounts, db.categories, db.transactions, db.recurringRules],
      async () => {
        for (const raw of accRes.data ?? []) {
          const remote = rowToAccount(raw);
          const local = await db.accounts.get(remote.id);
          if (!local || remote.updatedAt >= local.updatedAt) {
            await db.accounts.put(remote);
          }
        }
        for (const raw of catRes.data ?? []) {
          const remote = rowToCategory(raw);
          const local = await db.categories.get(remote.id);
          if (!local || remote.updatedAt >= local.updatedAt) {
            await db.categories.put(remote);
          }
        }
        for (const raw of txRes.data ?? []) {
          const remote = rowToTransaction(raw);
          const local = await db.transactions.get(remote.id);
          if (!local || remote.updatedAt >= local.updatedAt) {
            await db.transactions.put(remote);
          }
        }
        for (const raw of recRes.data ?? []) {
          const remote = rowToRecurring(raw);
          const local = await db.recurringRules.get(remote.id);
          if (!local || remote.updatedAt >= local.updatedAt) {
            await db.recurringRules.put(remote);
          }
        }
      }
    );

    const syncedAt = new Date().toISOString();
    const latestSettings = loadLocalSettings();
    saveLocalSettings({ ...latestSettings, lastSyncedAt: syncedAt });

    return { ok: true, syncedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore di sincronizzazione';
    return { ok: false, error: msg };
  } finally {
    syncInProgress = false;
  }
}
