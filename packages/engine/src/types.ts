/**
 * Définitions TypeScript du domaine Reste À Vivre (RAV)
 */

export type CurrencyCode = 'EUR' | 'USD' | 'CHF' | 'XOF' | 'XAF' | 'GBP';

export type WeekendStrategy = 'DYNAMIC_WEIGHT' | 'WEEKEND_PACK' | 'ROLLOVER';

export type SubscriptionTier = 'FREE' | 'PREMIUM_B2C' | 'B2B_CORPORATE';

export type PocketType = 'FOOD' | 'TRANSPORT' | 'PLEASURE' | 'CUSHION' | string;

export interface DynamicPocketDefinition {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  colorHex?: string;
  targetPercentage: number; // ex: 0.35 pour 35%
  displayOrder: number;
  isSystemDefault?: boolean;
  isArchived?: boolean;
}

export interface PocketConfig {
  id: string;
  key?: PocketType;
  name: string;
  icon: string;
  colorHex?: string;
  targetPercentage: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  displayOrder?: number;
  isSystemDefault?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  currency: CurrencyCode;
  weekendStrategy: WeekendStrategy;
  safetyCushionPercentage: number; // ex: 0.10 pour 10%
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
}

export interface CycleDefinition {
  id: string;
  userId: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
  declaredNetIncome: number;
  sanctuarySavings: number;
  totalFixedCharges: number;
  initialRavM: number;
  isActive: boolean;
}

export interface FixedChargeItem {
  id: string;
  userId: string;
  label: string;
  amount: number;
  category: 'LOGEMENT' | 'ENERGIE' | 'ASSURANCE' | 'TELECOM' | 'CREDIT' | 'AUTRE';
  isRecurring: boolean;
}

export interface ExpenseRecord {
  id: string;
  userId: string;
  pocketKey: PocketType;
  cycleId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  label: string;
  clientSyncId: string; // UUID généré côté client pour idempotence
  createdAt: Date;
}

export interface CycleMetrics {
  cycleStartDate: Date;
  cycleEndDate: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
}

export interface DailyRavCalculationResult {
  dailyRav: number;
  remainingDailyRav: number;
  spentToday: number;
  pockets: Record<PocketType, PocketConfig>;
  weekendAllocation: number;
}

export interface AiNudgeCard {
  id: string;
  level: 1 | 2 | 3 | 4;
  title: string;
  message: string;
  potentialDailyGain: number;
  actionLabel?: string;
}
