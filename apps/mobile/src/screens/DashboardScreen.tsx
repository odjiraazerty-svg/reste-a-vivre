import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { RavFormulas, RavPockets, RavNudges, PocketType, DynamicPocketDefinition } from '@rav/engine';
import { CircularGauge } from '../components/CircularGauge';
import { PocketCard } from '../components/PocketCard';
import { NumpadModal } from '../components/NumpadModal';
import { EveningRitualModal } from '../components/EveningRitualModal';
import { PocketsManagementModal } from '../components/PocketsManagementModal';
import { AiNudgeCard } from '../components/AiNudgeCard';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

export const DashboardScreen: React.FC<{ navigation?: any; currentUser?: any }> = ({ currentUser }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [eveningVisible, setEveningVisible] = useState(false);
  const [pocketsModalVisible, setPocketsModalVisible] = useState(false);
  const [selectedPocketForExpense, setSelectedPocketForExpense] = useState<any>(null);
  const [dailyRav, setDailyRav] = useState(0);
  const [currency, setCurrency] = useState('€');
  const [userName, setUserName] = useState<string>(
    currentUser?.username ? `@${currentUser.username}` : (currentUser?.email ? currentUser.email.split('@')[0] : '')
  );
  const [spentToday, setSpentToday] = useState(0);
  const [spentTodayByPocket, setSpentTodayByPocket] = useState<Record<string, number>>({});
  const [userPockets, setUserPockets] = useState<DynamicPocketDefinition[]>(RavPockets.getDefaultPockets());
  const [syncCount, setSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE'>('IDLE');
  const [payDayOfMonth, setPayDayOfMonth] = useState(28);
  const [weekendStrategy, setWeekendStrategy] = useState<'DYNAMIC_WEIGHT' | 'WEEKEND_PACK' | 'ROLLOVER'>('DYNAMIC_WEIGHT');

  const isWeekendToday = [0, 6].includes(new Date().getDay());
  const metrics = RavFormulas.computeCycleMetrics(payDayOfMonth);

  const distributedPockets = RavPockets.distributeDynamic(dailyRav, userPockets, spentTodayByPocket);
  const nudge = RavNudges.generateDynamicNudge({
    dailyRav,
    spentToday,
    currency
  });

  const refreshFinancialEngine = async () => {
    // 1. Charger la calibration profil
    const calib = await StorageService.getProfileCalibration();
    const strategy = calib?.weekendStrategy || 'DYNAMIC_WEIGHT';
    const payDay = calib?.payDayOfMonth || 28;
    setWeekendStrategy(strategy);
    setPayDayOfMonth(payDay);

    const cycleMetrics = RavFormulas.computeCycleMetrics(payDay);
    const initialRavM = calib?.monthlyRav || RavFormulas.calculateInitialRavM(
      calib?.netIncome || 0,
      calib?.fixedChargesTotal || 0,
      calib?.sanctuarySavings || 0
    );

    // 2. Charger les dépenses locales pour déduire ce qui est dépensé aujourd'hui et antérieurement
    const localExpenses = await StorageService.getLocalExpenses();
    const todayStr = new Date().toISOString().split('T')[0];

    const todayExps = localExpenses.filter(e => e.date === todayStr);
    const todayTotal = todayExps.reduce((s, e) => s + e.amount, 0);
    setSpentToday(todayTotal);

    const spentByPocket: Record<string, number> = {};
    todayExps.forEach(e => {
      spentByPocket[e.pocketKey] = (spentByPocket[e.pocketKey] || 0) + e.amount;
    });
    setSpentTodayByPocket(spentByPocket);

    // Dépenses antérieures dans le cycle en cours
    const priorExps = localExpenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate >= cycleMetrics.cycleStartDate && eDate <= cycleMetrics.cycleEndDate && e.date < todayStr;
    });
    const priorTotal = priorExps.reduce((s, e) => s + e.amount, 0);

    // 3. Calcul du RAV quotidien dynamique (avec boost x2.0 le week-end !)
    const dynamicDaily = RavFormulas.calculateDailyRav({
      initialRavM,
      totalSpentPriorInCycle: priorTotal,
      remainingDays: cycleMetrics.remainingDays,
      strategy,
      isWeekendToday
    });

    setDailyRav(dynamicDaily);
  };

  useEffect(() => {
    // 0. Récupérer l'utilisateur courant pour sa devise et son nom
    const activeUser = currentUser;
    if (activeUser) {
      const name = activeUser.username ? `@${activeUser.username}` : (activeUser.email ? activeUser.email.split('@')[0] : '');
      if (name) setUserName(name);
      if (activeUser.currency) {
        const symbolMap: Record<string, string> = {
          EUR: '€',
          FCFA: 'FCFA',
          USD: '$',
          CHF: 'CHF'
        };
        setCurrency(symbolMap[activeUser.currency] || activeUser.currency);
      }
    } else {
      StorageService.getCurrentUser().then(user => {
        if (user) {
          const name = user.username ? `@${user.username}` : (user.email ? user.email.split('@')[0] : '');
          if (name) setUserName(name);
          if (user.currency) {
            const symbolMap: Record<string, string> = {
              EUR: '€',
              FCFA: 'FCFA',
              USD: '$',
              CHF: 'CHF'
            };
            setCurrency(symbolMap[user.currency] || user.currency);
          }
        }
      });
    }

    // 1. Charger les poches locales
    StorageService.getLocalPockets().then((local) => {
      if (local && local.length > 0) setUserPockets(local);
    });

    // 2. Synchronisation de la file d'attente au démarrage et rafraîchissement depuis PostgreSQL
    setSyncStatus('SYNCING');
    ApiService.syncPendingExpenses().then((res) => {
      if (res.synced > 0) {
        setSyncCount((prev) => prev + res.synced);
        setSyncStatus('SYNCED');
      } else if (res.error) {
        setSyncStatus('OFFLINE');
      } else {
        setSyncStatus('SYNCED');
      }
    });

    // 3. Charger les poches distantes si connecté
    ApiService.fetchPockets().then((data) => {
      if (data && Array.isArray(data.pockets) && data.pockets.length > 0) {
        setUserPockets(data.pockets);
        StorageService.saveLocalPockets(data.pockets);
      }
    }).catch(() => { });

    // 4. Calcul dynamique du RAVq avec gestion du Week-end
    refreshFinancialEngine();
  }, [currentUser]);

  const handlePocketCardPress = (pocket: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setSelectedPocketForExpense(pocket);
    setModalVisible(true);
  };

  const handleExpenseSubmit = async (pocketKey: any, amount: number, pocketName?: string) => {
    const targetPocket = userPockets.find(p => p.id === pocketKey || p.name === pocketKey || (p as any).key === pocketKey);
    const resolvedLabel = pocketName || targetPocket?.name || 'Dépense';

    // 1. Sauvegarde locale instantanée à 0ms avec le libellé de la poche
    await StorageService.saveExpenseLocally({ pocketKey, amount, label: resolvedLabel });

    setSpentToday((prev) => prev + amount);
    setSpentTodayByPocket((prev) => ({
      ...prev,
      [pocketKey]: (prev[pocketKey] || 0) + amount
    }));

    // 2. Synchronisation transparente vers PostgreSQL en arrière-plan
    setSyncStatus('SYNCING');
    ApiService.syncPendingExpenses().then((res) => {
      if (res.synced > 0) {
        setSyncCount((prev) => prev + res.synced);
        setSyncStatus('SYNCED');
      } else if (res.error) {
        setSyncStatus('OFFLINE');
      } else {
        setSyncStatus('SYNCED');
      }
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.bgDeep }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greetingSub, { color: themeColors.textSecondary }]}>
              {userName ? `Bonjour ${userName} 👋` : 'Bonjour 👋'}
            </Text>
            <Text style={[styles.greetingTitle, { color: themeColors.textPrimary }]}>Reste À Vivre</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={[
              styles.devisePill,
              syncStatus === 'OFFLINE'
                ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                : { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }
            ]}>
              <Text style={[
                styles.deviseText,
                syncStatus === 'OFFLINE' ? { color: themeColors.accentRose } : { color: themeColors.accentEmerald }
              ]}>
                {syncStatus === 'OFFLINE' ? '⚡ Local' : syncCount > 0 ? `☁️ Sync (${syncCount})` : '☁️ Connecté'}
              </Text>
            </View>
            <View style={[styles.devisePill, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
              <Text style={[styles.deviseText, { color: themeColors.textPrimary }]}>{currency}</Text>
            </View>
          </View>
        </View>

        {/* Badge Cycle */}
        <View style={[styles.cycleBadge, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.cycleText, { color: themeColors.textSecondary }]}>
            Jour <Text style={{ color: themeColors.accentCyan }}>{metrics.elapsedDays}/{metrics.totalDays}</Text> • Reste <Text style={{ color: themeColors.accentEmerald }}>{metrics.remainingDays}j</Text>
          </Text>
          <View style={[
            styles.modePill,
            isWeekendToday && weekendStrategy === 'DYNAMIC_WEIGHT' && {
              backgroundColor: 'rgba(139, 92, 246, 0.2)',
              borderColor: themeColors.accentViolet,
              borderWidth: 1
            }
          ]}>
            <Text style={[
              styles.modeText,
              isWeekendToday && weekendStrategy === 'DYNAMIC_WEIGHT' && {
                color: isDark ? '#C4B5FD' : '#7C3AED',
                fontWeight: '800'
              }
            ]}>
              {isWeekendToday && weekendStrategy === 'DYNAMIC_WEIGHT'
                ? '🎉 Week-end Boost (w=2.0)'
                : weekendStrategy === 'DYNAMIC_WEIGHT'
                  ? 'Pondéré Week-end (w=2.0)'
                  : weekendStrategy === 'WEEKEND_PACK'
                    ? 'Pack Week-end'
                    : 'Rollover'}
            </Text>
          </View>
        </View>

        {/* Jauge Vivante du RAVq */}
        <CircularGauge
          remainingDailyRav={Math.max(0, dailyRav - spentToday)}
          totalDailyRav={dailyRav}
          currency={currency}
        />

        {/* Bouton Saisie Express 2-Taps (< 10s) */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            setSelectedPocketForExpense(null);
            setModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIconBox}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
            </View>
            <Text style={styles.ctaLabel}>Saisie Express « 2-Taps »</Text>
          </View>
          <View style={styles.ctaBadge}>
            <Text style={styles.ctaBadgeText}>&lt; 10s</Text>
          </View>
        </TouchableOpacity>

        {/* Déclencheur Bilan de 20h30 (Clôture du Soir) */}
        <TouchableOpacity
          style={[
            styles.eveningCard,
            {
              backgroundColor: isDark ? 'rgba(30, 41, 69, 0.8)' : '#EDE9FE',
              borderColor: isDark ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.3)'
            }
          ]}
          onPress={() => setEveningVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.eveningLeft}>
            <View style={[styles.moonBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)' }]}>
              <Text style={{ fontSize: 16 }}>🌙</Text>
            </View>
            <View>
              <Text style={[styles.eveningTitle, { color: isDark ? '#FFFFFF' : '#4C1D95' }]}>Bilan à 20h30 : Clôturer ma journée</Text>
              <Text style={[styles.eveningSub, { color: isDark ? '#A5B4FC' : '#6D28D9' }]}>Ajustement rapide des 4 poches</Text>
            </View>
          </View>
          <View style={[styles.eveningBadge, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.2)' }]}>
            <Text style={[styles.eveningBadgeText, { color: isDark ? '#DDD6FE' : '#5B21B6' }]}>15 sec</Text>
          </View>
        </TouchableOpacity>

        {/* Grille Dynamique des Poches Budgétaires */}
        <View style={styles.pocketsSection}>
          <View style={styles.pocketsHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>📁 Vos {distributedPockets.length} Poches</Text>
            <TouchableOpacity
              style={styles.btnManagePockets}
              onPress={() => setPocketsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnManagePocketsText}>⚙️ Gérer mes poches</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pocketsGridContainer}>
            {distributedPockets.map((p) => (
              <View key={p.id} style={styles.pocketCardWrapper}>
                <PocketCard
                  pocket={p}
                  currency={currency}
                  onPress={() => handlePocketCardPress(p)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Carte Nudge IA */}
        <AiNudgeCard nudge={nudge} />
      </ScrollView>

      {/* Modal Saisie 2-Taps avec Poches Dynamiques */}
      <NumpadModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedPocketForExpense(null);
        }}
        onValidate={handleExpenseSubmit}
        pockets={distributedPockets}
        currency={currency}
        initialPocket={selectedPocketForExpense}
      />

      {/* Modal de Gestion & Personnalisation des Poches */}
      <PocketsManagementModal
        visible={pocketsModalVisible}
        onClose={() => setPocketsModalVisible(false)}
        pockets={userPockets}
        onPocketsUpdated={(updated) => setUserPockets(updated)}
      />

      {/* Modal Clôture du Soir (Bilan 20h30) */}
      <EveningRitualModal
        visible={eveningVisible}
        onClose={() => setEveningVisible(false)}
        allocatedDailyRav={dailyRav}
        spentTodayByPocket={spentTodayByPocket}
        currency={currency}
        onComplete={(adj) => {
          setSpentTodayByPocket(adj);
          const total = Object.values(adj).reduce((s, v) => s + v, 0);
          setSpentToday(total);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDeep
  },
  container: {
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5
  },
  devisePill: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  deviseText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12
  },
  cycleBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10
  },
  cycleText: {
    color: colors.textSecondary,
    fontSize: 11.5
  },
  modePill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99
  },
  modeText: {
    color: colors.accentViolet,
    fontSize: 10,
    fontWeight: '700'
  },
  ctaButton: {
    backgroundColor: colors.accentEmerald,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  ctaIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#051A14'
  },
  ctaBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99
  },
  ctaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700'
  },
  pocketsSection: {
    marginVertical: 10
  },
  pocketsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  btnManagePockets: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  btnManagePocketsText: {
    fontSize: 11.5,
    color: colors.accentViolet,
    fontWeight: '700'
  },
  pocketsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  pocketCardWrapper: {
    width: '48.5%',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  eveningCard: {
    backgroundColor: 'rgba(30, 41, 69, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  eveningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  moonBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  eveningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  eveningSub: {
    fontSize: 11,
    color: '#A5B4FC'
  },
  eveningBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99
  },
  eveningBadgeText: {
    color: '#DDD6FE',
    fontSize: 10,
    fontWeight: '700'
  }
});
