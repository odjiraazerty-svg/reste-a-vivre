import { Platform } from 'react-native';
import { StorageService, StoredUser } from './storage';

// URL de l'API Fastify en Production Cloud (Render.com + Neon.tech)
function resolveApiBaseUrl(): string {
  return 'https://reste-a-vivre.onrender.com/api/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

export interface AuthResponse {
  user: StoredUser;
  token: string;
}

export class ApiService {
  private static token: string | null = null;

  public static setAuthToken(token: string | null) {
    this.token = token;
  }

  public static async getAuthToken(): Promise<string | null> {
    if (this.token) return this.token;
    const stored = await StorageService.getAuthToken();
    if (stored) {
      this.token = stored;
      return stored;
    }
    return null;
  }

  /**
   * Connexion utilisateur (par Pseudo ou Email)
   */
  public static async login(identifier: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Identifiants incorrects');
    }

    this.token = data.token;
    await StorageService.setAuthToken(data.token);
    await StorageService.setCurrentUser(data.user);

    return data;
  }

  /**
   * Création de compte (par Pseudo ou Email + Poches Initiales)
   */
  public static async register(
    identifier: string,
    password: string,
    currency: string = 'EUR',
    initialPockets?: any[]
  ): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, currency, initialPockets })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors de la création de compte');
    }

    this.token = data.token;
    await StorageService.setAuthToken(data.token);
    await StorageService.setCurrentUser(data.user);

    return data;
  }

  /**
   * Déconnexion
   */
  public static async logout(): Promise<void> {
    this.token = null;
    await StorageService.clearSession();
  }

  /**
   * Synchronise la file d'attente hors-ligne avec la table PostgreSQL expenses
   */
  public static async syncPendingExpenses(): Promise<{ synced: number; error?: string }> {
    try {
      const pendingQueue = await StorageService.getPendingSyncQueue();

      if (pendingQueue.length === 0) {
        return { synced: 0 };
      }

      const token = await this.getAuthToken();
      if (!token) {
        return { synced: 0, error: 'Non authentifié' };
      }

      const response = await fetch(`${API_BASE_URL}/expenses/batch-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          expenses: pendingQueue.map(item => ({
            clientSyncId: item.clientSyncId,
            pocketId: item.pocketKey,
            amount: item.amount,
            date: item.date,
            label: item.label
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        await StorageService.clearPendingSyncQueue();
        return { synced: result.insertedCount || pendingQueue.length };
      } else {
        const err = await response.json();
        return { synced: 0, error: err.error || 'Erreur lors de la synchronisation' };
      }
    } catch (err: any) {
      return { synced: 0, error: err.message || 'Serveur inaccessible' };
    }
  }

  /**
   * Récupère la liste des poches depuis PostgreSQL
   */
  public static async fetchPockets(): Promise<{ pockets: any[] }> {
    const list = await this.fetchPocketsFromPostgres();
    return { pockets: list };
  }

  public static async fetchPocketsFromPostgres(): Promise<any[]> {
    const token = await this.getAuthToken();
    if (!token) return [];

    try {
      const response = await fetch(`${API_BASE_URL}/pockets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data.pockets || [];
      }
    } catch (err: any) {
      console.warn('[API Pockets] Impossible de charger les poches distantes:', err.message);
    }
    return [];
  }

  public static async createPocket(pocket: any): Promise<boolean> {
    return this.savePocketToPostgres(pocket);
  }

  public static async updatePocket(id: string, updates: any): Promise<boolean> {
    return this.savePocketToPostgres({ id, ...updates });
  }

  public static async archivePocket(id: string): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/pockets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Met à jour ou crée les poches dans PostgreSQL
   */
  public static async savePocketToPostgres(pocket: any): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    try {
      const url = pocket.id ? `${API_BASE_URL}/pockets/${pocket.id}` : `${API_BASE_URL}/pockets`;
      const method = pocket.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pocket)
      });

      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Calibre le cycle de Reste À Vivre (revenus, charges fixes, épargne, jour de paie)
   */
  public static async calibrateCycle(params: {
    declaredNetIncome: number;
    totalFixedCharges: number;
    sanctuarySavings: number;
    payDayOfMonth?: number;
    weekendStrategy?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: 'Non authentifié' };

    try {
      const response = await fetch(`${API_BASE_URL}/cycles/calibrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Erreur lors de la calibration' };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Serveur injoignable' };
    }
  }

  /**
   * Modifie une dépense existante dans PostgreSQL
   */
  public static async updateExpense(
    id: string,
    updates: { amount?: number; pocketId?: string; label?: string; expenseDate?: string }
  ): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Supprime une dépense dans PostgreSQL
   */
  public static async deleteExpense(id: string): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }
}
