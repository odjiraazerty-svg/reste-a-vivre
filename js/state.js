/**
 * GESTIONNAIRE D'ÉTAT CENTRAL & SIMULATEUR POSTGRESQL SYNC
 * Persistance locale instantanée (0ms) + File de synchronisation PostgreSQL
 */

export class AppState {
  constructor() {
    this.STORAGE_KEY = 'rav_saas_app_state_v1';
    this.data = this.loadState();
  }

  getDefaultState() {
    return {
      user: {
        id: 'usr_7f83a1b2-c0e4-4d89-9821-654e99f81a02',
        email: 'alexandre.dupont@entreprise.fr',
        currency: '€',
        subscriptionTier: 'FREE',
        weekendStrategy: 'DYNAMIC_WEIGHT', // DYNAMIC_WEIGHT | WEEKEND_PACK | ROLLOVER
        payDayOfMonth: 28,
        netIncome: 2400.00,
        fixedChargesTotal: 1250.00,
        sanctuarySavings: 200.00,
        weekendPackBalance: 120.00
      },
      fixedChargesList: [
        { id: 'fix_1', label: 'Loyer & Charges', amount: 820.00, category: 'Logement' },
        { id: 'fix_2', label: 'Énergie & Box Internet', amount: 140.00, category: 'Factures' },
        { id: 'fix_3', label: 'Assurance & Mutuelle', amount: 90.00, category: 'Assurance' },
        { id: 'fix_4', label: 'Remboursement Prêt Auto', amount: 150.00, category: 'Crédit' },
        { id: 'fix_5', label: 'Abonnements Numériques', amount: 50.00, category: 'Loisirs' }
      ],
      pockets: [
        { id: 'pocket_food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1 },
        { id: 'pocket_transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2 },
        { id: 'pocket_pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3 },
        { id: 'pocket_cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isCushion: true }
      ],
      expenses: [
        {
          id: 'exp_01a',
          clientSyncId: 'sync_991823-a1',
          pocketId: 'pocket_food',
          amount: 8.50,
          label: 'Sandwich & Café du midi',
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pgSyncStatus: 'SYNCED'
        },
        {
          id: 'exp_02b',
          clientSyncId: 'sync_991823-b2',
          pocketId: 'pocket_transport',
          amount: 4.20,
          label: 'Recharge Pass Navigo / Ticket',
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pgSyncStatus: 'SYNCED'
        }
      ],
      pgSyncQueue: [
        {
          timestamp: new Date().toISOString(),
          operation: 'INSERT INTO expenses',
          recordId: 'exp_01a',
          status: 'COMMITTED_ACID',
          latencyMs: 14
        },
        {
          timestamp: new Date().toISOString(),
          operation: 'INSERT INTO expenses',
          recordId: 'exp_02b',
          status: 'COMMITTED_ACID',
          latencyMs: 18
        }
      ]
    };
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.pockets || parsed.pockets.length === 0) {
          parsed.pockets = [
            { id: 'pocket_food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1 },
            { id: 'pocket_transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2 },
            { id: 'pocket_pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3 },
            { id: 'pocket_cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isCushion: true }
          ];
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Erreur lecture localStorage:', e);
    }
    return this.getDefaultState();
  }

  saveState() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Erreur sauvegarde localStorage:', e);
    }
  }

  /**
   * Enregistre instantanément une dépense (« 2-Taps »)
   */
  addExpense({ pocketId, amount, label = '' }) {
    const newId = 'exp_' + Math.random().toString(36).substr(2, 9);
    const syncId = 'uuid_' + Math.random().toString(36).substr(2, 9);

    const expenseItem = {
      id: newId,
      clientSyncId: syncId,
      pocketId,
      amount: Number(amount),
      label: label || this.getDefaultLabelForPocket(pocketId),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pgSyncStatus: 'SYNCED' // Synchronisé avec la BDD PostgreSQL
    };

    // 1. Écriture immédiate dans le store local (0ms de latence)
    this.data.expenses.unshift(expenseItem);

    // 2. Traçabilité dans le journal PostgreSQL
    this.data.pgSyncQueue.unshift({
      timestamp: new Date().toISOString(),
      operation: `INSERT INTO expenses (id, user_id, pocket_id, amount, client_sync_id)`,
      recordId: newId,
      status: 'COMMITTED_ACID',
      latencyMs: Math.floor(Math.random() * 25) + 12
    });

    // Garde un historique des 50 dernières requêtes SQL
    if (this.data.pgSyncQueue.length > 50) {
      this.data.pgSyncQueue = this.data.pgSyncQueue.slice(0, 50);
    }

    this.saveState();
    return expenseItem;
  }

  getDefaultLabelForPocket(pocketId) {
    switch (pocketId) {
      case 'pocket_food': return 'Repas / Courses express';
      case 'pocket_transport': return 'Mobilité / Carburant / VTC';
      case 'pocket_pleasure': return 'Café / Plaisir du jour';
      case 'pocket_cushion': return 'Absorption imprévu';
      default: return 'Dépense rapide';
    }
  }

  updateSettings({ netIncome, fixedChargesTotal, sanctuarySavings, payDayOfMonth, weekendStrategy, currency }) {
    if (netIncome !== undefined) this.data.user.netIncome = Number(netIncome);
    if (fixedChargesTotal !== undefined) this.data.user.fixedChargesTotal = Number(fixedChargesTotal);
    if (sanctuarySavings !== undefined) this.data.user.sanctuarySavings = Number(sanctuarySavings);
    if (payDayOfMonth !== undefined) this.data.user.payDayOfMonth = Number(payDayOfMonth);
    if (weekendStrategy !== undefined) this.data.user.weekendStrategy = weekendStrategy;
    if (currency !== undefined) this.data.user.currency = currency;

    this.saveState();
  }

  getTodayExpenses() {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.data.expenses.filter(e => e.date === todayStr);
  }

  getTotalSpentInCurrentCycle() {
    return this.data.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  deleteExpense(id) {
    this.data.expenses = this.data.expenses.filter(e => e.id !== id);
    this.saveState();
  }

  resetAll() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.data = this.getDefaultState();
    this.saveState();
  }
}

export const state = new AppState();
