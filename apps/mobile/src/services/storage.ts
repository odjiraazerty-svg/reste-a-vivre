import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseRecord, PocketType, DynamicPocketDefinition, RavPockets } from '@rav/engine';

export interface StoredUser {
  id: string;
  username?: string;
  email?: string;
  currency: string;
  weekendStrategy?: string;
  subscriptionTier?: string;
}

export interface UserProfileCalibration {
  netIncome: number;
  fixedChargesTotal: number;
  sanctuarySavings: number;
  payDayOfMonth: number;
  weekendStrategy: 'DYNAMIC_WEIGHT' | 'WEEKEND_PACK' | 'ROLLOVER';
  dailyRav: number;
  monthlyRav: number;
  updatedAt: string;
}

const STORAGE_KEYS = {
  AUTH_TOKEN: '@rav_auth_token',
  CURRENT_USER: '@rav_current_user',
  USER_PROFILE: '@rav_user_profile',
  EXPENSES: '@rav_expenses_list',
  PENDING_SYNC: '@rav_pending_sync_queue',
  DYNAMIC_POCKETS: '@rav_dynamic_pockets',
  THEME_MODE: '@rav_theme_mode'
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class StorageService {
  /**
   * Gestion Session Utilisateur & Token
   */
  public static async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  public static async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  public static async getCurrentUser(): Promise<StoredUser | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  }

  public static async setCurrentUser(user: StoredUser): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  public static async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    await AsyncStorage.removeItem(STORAGE_KEYS.EXPENSES);
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    await AsyncStorage.removeItem(STORAGE_KEYS.DYNAMIC_POCKETS);
  }

  public static async resetAllStorage(): Promise<void> {
    await AsyncStorage.clear();
  }

  /**
   * Enregistre instantanément une dépense en local (0 ms de latence réseau)
   */
  public static async saveExpenseLocally(params: {
    pocketKey: PocketType;
    amount: number;
    label?: string;
  }): Promise<ExpenseRecord> {
    const user = await this.getCurrentUser();
    const userId = user?.id || '7f83a1b2-c0e4-4d89-9821-654e99f81a02';

    const newExpense: ExpenseRecord = {
      id: generateUUID(),
      userId,
      pocketKey: params.pocketKey,
      cycleId: 'c123a1b2-c0e4-4d89-9821-654e99f81a01',
      amount: params.amount,
      date: new Date().toISOString().split('T')[0],
      label: params.label || '',
      clientSyncId: generateUUID(),
      createdAt: new Date()
    };

    // 1. Sauvegarde dans la liste locale des dépenses
    const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
    const existingList: ExpenseRecord[] = existingStr ? JSON.parse(existingStr) : [];
    existingList.unshift(newExpense);
    await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(existingList));

    // 2. Ajout dans la file de synchronisation PostgreSQL d'arrière-plan
    const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    const pendingQueue: ExpenseRecord[] = pendingStr ? JSON.parse(pendingStr) : [];
    pendingQueue.unshift(newExpense);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pendingQueue));

    return newExpense;
  }

  public static async getLocalExpenses(): Promise<ExpenseRecord[]> {
    const str = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
    return str ? JSON.parse(str) : [];
  }

  /**
   * Met à jour une dépense existante en local
   */
  public static async updateExpenseLocally(
    id: string,
    updates: {
      amount?: number;
      pocketKey?: string;
      label?: string;
      date?: string;
    }
  ): Promise<ExpenseRecord | null> {
    const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
    const list: ExpenseRecord[] = existingStr ? JSON.parse(existingStr) : [];
    const index = list.findIndex(e => e.id === id || e.clientSyncId === id);
    if (index === -1) return null;

    list[index] = {
      ...list[index],
      ...updates
    };

    await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(list));
    return list[index];
  }

  /**
   * Supprime une dépense localement
   */
  public static async deleteExpenseLocally(id: string): Promise<boolean> {
    const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
    const list: ExpenseRecord[] = existingStr ? JSON.parse(existingStr) : [];
    const filtered = list.filter(e => e.id !== id && e.clientSyncId !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));
    return true;
  }

  public static async getPendingSyncQueue(): Promise<ExpenseRecord[]> {
    const str = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    return str ? JSON.parse(str) : [];
  }

  public static async clearPendingSyncQueue(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify([]));
  }

  public static async getLocalPockets(): Promise<DynamicPocketDefinition[]> {
    const str = await AsyncStorage.getItem(STORAGE_KEYS.DYNAMIC_POCKETS);
    if (!str) {
      const defaults = RavPockets.getDefaultPockets();
      await AsyncStorage.setItem(STORAGE_KEYS.DYNAMIC_POCKETS, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(str);
  }

  public static async saveLocalPockets(pockets: DynamicPocketDefinition[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.DYNAMIC_POCKETS, JSON.stringify(pockets));
  }

  /**
   * Gestion de la calibration des flux (Revenus, Charges fixes, Épargne, RAVq)
   */
  public static async getProfileCalibration(): Promise<UserProfileCalibration | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }

  public static async saveProfileCalibration(calibration: UserProfileCalibration): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(calibration));
  }

  /**
   * Gestion du Thème (Fond Blanc ou Nuit)
   */
  public static async getThemeMode(): Promise<'dark' | 'light'> {
    const mode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
    return mode === 'light' ? 'light' : 'dark';
  }

  public static async setThemeMode(mode: 'dark' | 'light'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
  }
}
