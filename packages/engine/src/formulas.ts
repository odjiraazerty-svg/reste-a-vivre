import { WeekendStrategy, CycleMetrics } from './types';

export class RavFormulas {
  /**
   * Calcule le RAV Mensuel Initial (RAVm)
   * Formule : RAVm = Revenus Nets Déclarés - (Charges Fixes + Épargne Sanctuarisée)
   */
  public static calculateInitialRavM(
    declaredNetIncome: number,
    totalFixedCharges: number,
    sanctuarySavings: number
  ): number {
    const income = Math.max(0, declaredNetIncome || 0);
    const fixed = Math.max(0, totalFixedCharges || 0);
    const savings = Math.max(0, sanctuarySavings || 0);

    const ravm = income - (fixed + savings);
    return Math.max(0, Number(ravm.toFixed(2)));
  }

  /**
   * Détermine les bornes et jours restants dans le cycle de paie
   * @param payDayOfMonth - Jour de versement du salaire (ex: 28)
   * @param referenceDate - Date de calcul (défaut: aujourd'hui)
   */
  public static computeCycleMetrics(
    payDayOfMonth: number = 28,
    referenceDate: Date = new Date()
  ): CycleMetrics {
    const now = new Date(referenceDate);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let cycleStartDate: Date;
    let cycleEndDate: Date;

    if (currentDay >= payDayOfMonth) {
      cycleStartDate = new Date(currentYear, currentMonth, payDayOfMonth);
      cycleEndDate = new Date(currentYear, currentMonth + 1, payDayOfMonth - 1);
    } else {
      cycleStartDate = new Date(currentYear, currentMonth - 1, payDayOfMonth);
      cycleEndDate = new Date(currentYear, currentMonth, payDayOfMonth - 1);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / msPerDay) + 1;
    const elapsedDays = Math.max(1, Math.round((now.getTime() - cycleStartDate.getTime()) / msPerDay) + 1);
    const remainingDays = Math.max(1, Math.round((cycleEndDate.getTime() - now.getTime()) / msPerDay) + 1);

    return {
      cycleStartDate,
      cycleEndDate,
      totalDays,
      elapsedDays,
      remainingDays
    };
  }

  /**
   * Calcule le RAV Quotidien Opérationnel (RAVq) avec lissage continu et gestion du week-end
   */
  public static calculateDailyRav(params: {
    initialRavM: number;
    totalSpentPriorInCycle: number;
    remainingDays: number;
    strategy: WeekendStrategy;
    isWeekendToday: boolean;
    weekendPackReserve?: number;
  }): number {
    const {
      initialRavM,
      totalSpentPriorInCycle,
      remainingDays,
      strategy,
      isWeekendToday,
      weekendPackReserve = 0
    } = params;

    const remainingCycleBudget = Math.max(0, initialRavM - totalSpentPriorInCycle);

    if (remainingDays <= 1) {
      return Number(remainingCycleBudget.toFixed(2));
    }

    if (strategy === 'DYNAMIC_WEIGHT') {
      const todayWeight = isWeekendToday ? 2.0 : 1.0;
      const weekendDaysRemaining = Math.round(remainingDays * (2 / 7));
      const weekdayDaysRemaining = Math.max(1, remainingDays - weekendDaysRemaining);
      const totalWeightedDays = (weekdayDaysRemaining * 1.0) + (weekendDaysRemaining * 2.0);

      const dailyAllocation = (remainingCycleBudget / totalWeightedDays) * todayWeight;
      return Number(dailyAllocation.toFixed(2));
    }

    if (strategy === 'WEEKEND_PACK') {
      if (isWeekendToday) {
        const weekendShare = weekendPackReserve / 2;
        return Number(weekendShare.toFixed(2));
      } else {
        const weekdayShare = (remainingCycleBudget * 0.6) / Math.max(1, remainingDays * (5 / 7));
        return Number(weekdayShare.toFixed(2));
      }
    }

    // Stratégie Rollover / Uniforme
    const flatAllocation = remainingCycleBudget / remainingDays;
    return Number(flatAllocation.toFixed(2));
  }
}
