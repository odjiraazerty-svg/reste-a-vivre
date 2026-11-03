import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { RavAuditEngine, SubscriptionAuditItem } from '@rav/engine';
import { StorageService } from '../services/storage';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface SubscriptionStateItem extends SubscriptionAuditItem {
  optimized: boolean;
  dailyGain: number;
}

const getSubscriptionsForCurrency = (curr: string): SubscriptionStateItem[] => {
  const isFcfa = curr === 'FCFA';

  if (isFcfa) {
    return [
      {
        id: 'sub_gym',
        name: 'Salle de Sport (Non fréquentée)',
        category: 'FITNESS',
        monthlyCost: 25000,
        icon: '🏋️',
        status: 'ACTIVE',
        recommendation: 'Dernier passage il y a 45 jours. Résilier libère immédiatement +833 FCFA/jour.',
        optimized: true,
        dailyGain: 833
      },
      {
        id: 'sub_stream',
        name: 'Abonnement Streaming Vidéo n°2',
        category: 'STREAMING',
        monthlyCost: 10000,
        icon: '🎬',
        status: 'ACTIVE',
        recommendation: 'Doublon avec votre 1er service. Suspendre libère +333 FCFA/jour.',
        optimized: true,
        dailyGain: 333
      },
      {
        id: 'sub_tel',
        name: 'Forfait Mobile Surdimensionné',
        category: 'TELECOM',
        monthlyCost: 12000,
        icon: '📱',
        status: 'ACTIVE',
        recommendation: 'Consommation réelle modérée. Réajuster l\'offre libère +400 FCFA/jour.',
        optimized: true,
        dailyGain: 400
      },
      {
        id: 'sub_assur',
        name: 'Assurance Appareils / Doublons',
        category: 'ASSURANCE',
        monthlyCost: 8000,
        icon: '🛡️',
        status: 'ACTIVE',
        recommendation: 'Double couverture identifiée. Résilier libère +267 FCFA/jour.',
        optimized: true,
        dailyGain: 267
      }
    ];
  }

  return [
    {
      id: 'sub_gym',
      name: 'Salle de Sport (Non fréquentée)',
      category: 'FITNESS',
      monthlyCost: 39.99,
      icon: '🏋️',
      status: 'ACTIVE',
      recommendation: `Dernier passage il y a 45 jours. Résilier libère immédiatement +1.33 ${curr}/jour.`,
      optimized: true,
      dailyGain: 1.33
    },
    {
      id: 'sub_stream',
      name: 'Abonnement Streaming Vidéo n°2',
      category: 'STREAMING',
      monthlyCost: 17.99,
      icon: '🎬',
      status: 'ACTIVE',
      recommendation: `Doublon avec votre 1er service. Suspendre libère +0.60 ${curr}/jour.`,
      optimized: true,
      dailyGain: 0.60
    },
    {
      id: 'sub_tel',
      name: 'Forfait Mobile 200 Go surdimensionné',
      category: 'TELECOM',
      monthlyCost: 20.00,
      icon: '📱',
      status: 'ACTIVE',
      recommendation: `Consommation réelle < 15 Go. Optimiser libère +0.67 ${curr}/jour.`,
      optimized: true,
      dailyGain: 0.67
    },
    {
      id: 'sub_assur',
      name: 'Assurance Appareils / Doublon carte',
      category: 'ASSURANCE',
      monthlyCost: 14.50,
      icon: '🛡️',
      status: 'ACTIVE',
      recommendation: `Déjà couvert par votre carte bancaire. Résilier libère +0.48 ${curr}/jour.`,
      optimized: true,
      dailyGain: 0.48
    }
  ];
};

export const AiAuditScreen: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [latteDays, setLatteDays] = useState(3);
  const [currency, setCurrency] = useState('€');
  const [subscriptions, setSubscriptions] = useState<SubscriptionStateItem[]>(
    getSubscriptionsForCurrency('€')
  );

  useEffect(() => {
    const resolveCurrency = (rawCurr?: string) => {
      const symbolMap: Record<string, string> = { EUR: '€', FCFA: 'FCFA', USD: '$', CHF: 'CHF' };
      const resolved = rawCurr ? (symbolMap[rawCurr] || rawCurr) : '€';
      setCurrency(resolved);
      setSubscriptions(getSubscriptionsForCurrency(resolved));
    };

    const user = currentUser;
    if (user && user.currency) {
      resolveCurrency(user.currency);
    } else {
      StorageService.getCurrentUser().then(u => {
        if (u && u.currency) {
          resolveCurrency(u.currency);
        }
      });
    }
  }, [currentUser]);

  const toggleSub = (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }

    setSubscriptions(prev =>
      prev.map(sub => sub.id === id ? { ...sub, optimized: !sub.optimized } : sub)
    );
  };

  // Calcul des gains
  const subDailyGain = subscriptions
    .filter(s => s.optimized)
    .reduce((sum, s) => sum + s.dailyGain, 0);

  const latteUnitPrice = currency === 'FCFA' ? 1000 : 2.20;
  const latteMetrics = RavAuditEngine.computeLatteMetrics(latteUnitPrice, latteDays);
  const totalDailyGain = Number((subDailyGain + latteMetrics.dailyEquivalent).toFixed(2));
  const totalAnnualGain = Math.round(totalDailyGain * 365);

  const handleApply = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { }
    alert(`🎉 Félicitations ! Vos +${totalDailyGain.toLocaleString()} ${currency}/jour ont été réinjectés dans votre Reste À Vivre.`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.bgDeep }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✨ Moteur Bienveillant • Section 4</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Audit IA & Chasse aux Charges</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Convertissez vos abonnements dormants et micro-dépenses en pouvoir d'achat quotidien immédiat.
          </Text>
        </View>

        {/* Hero Card : Gain Quotidien */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)', borderColor: themeColors.accentEmerald }]}>
          <Text style={styles.heroLabel}>GAIN DE LIBERTÉ QUOTIDIENNE DÉTECTÉ</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmount}>+{totalDailyGain.toLocaleString()} {currency}</Text>
            <Text style={styles.heroUnit}>/ jour</Text>
          </View>
          <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
            Soit <Text style={[styles.heroBold, { color: themeColors.textPrimary }]}>+{totalAnnualGain.toLocaleString()} {currency} / an</Text> réinjectés dans votre Reste À Vivre ou votre Pack Week-end !
          </Text>
        </View>

        {/* Niveau 1 : Charges Fixes Cachées & Abonnements */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>🎯 Niveau 1 : Abonnements Cachés</Text>
          <Text style={styles.countBadge}>{subscriptions.filter(s => s.optimized).length}/{subscriptions.length} cochés</Text>
        </View>

        {subscriptions.map(sub => (
          <TouchableOpacity
            key={sub.id}
            style={[
              styles.subCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle },
              sub.optimized && styles.subCardActive
            ]}
            activeOpacity={0.8}
            onPress={() => toggleSub(sub.id)}
          >
            <View style={styles.subTopRow}>
              <View style={styles.subLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9' }]}>
                  <Text style={styles.subIcon}>{sub.icon}</Text>
                </View>
                <View style={styles.subMeta}>
                  <Text style={[styles.subName, { color: themeColors.textPrimary }]}>{sub.name}</Text>
                  <Text style={styles.subCost}>-{sub.monthlyCost.toLocaleString()} {currency} / mois</Text>
                </View>
              </View>
              <Switch
                value={sub.optimized}
                onValueChange={() => toggleSub(sub.id)}
                trackColor={{ false: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', true: themeColors.accentEmerald }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text style={[styles.subRec, { color: themeColors.textSecondary }]}>{sub.recommendation}</Text>

            <View style={[styles.subGainPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={styles.subGainText}>
                {sub.optimized
                  ? `✅ Gain actif : +${sub.dailyGain.toLocaleString()} ${currency}/jour`
                  : `⚪ Gain potentiel : +${sub.dailyGain.toLocaleString()} ${currency}/jour`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Niveau 2 : Effet Latte & Micro-Dépenses */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>☕ Niveau 2 : Effet Latte & Déplacements</Text>
        </View>

        <View style={[styles.latteCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <View style={styles.latteHeader}>
            <Text style={[styles.latteTitle, { color: themeColors.textPrimary }]}>Café emporté & Snacks express</Text>
            <Text style={styles.lattePill}>{latteUnitPrice.toLocaleString()} {currency} / unité</Text>
          </View>
          <Text style={[styles.latteDesc, { color: themeColors.textSecondary }]}>
            Préparer son café chez soi 3 fois par semaine finance l'intégralité d'une sortie détente le samedi.
          </Text>

          <View style={styles.stepperRow}>
            <Text style={[styles.stepperLabel, { color: themeColors.textSecondary }]}>Fréquence préparée à la maison :</Text>
            <View style={styles.stepperControls}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}
                onPress={() => {
                  if (latteDays > 0) {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) { }
                    setLatteDays(latteDays - 1);
                  }
                }}
              >
                <Text style={[styles.stepBtnText, { color: themeColors.textPrimary }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.stepperVal, { color: themeColors.textPrimary }]}>{latteDays} j/sem</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}
                onPress={() => {
                  if (latteDays < 5) {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) { }
                    setLatteDays(latteDays + 1);
                  }
                }}
              >
                <Text style={[styles.stepBtnText, { color: themeColors.textPrimary }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.latteImpactBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.15)', borderColor: themeColors.accentViolet }]}>
            <View>
              <Text style={styles.latteImpactLabel}>GAIN DÉBLOQUÉ PACK WEEK-END</Text>
              <Text style={[styles.latteImpactSub, { color: themeColors.textSecondary }]}>Directement transféré au pot samedi/dimanche</Text>
            </View>
            <Text style={[styles.latteImpactVal, { color: themeColors.accentViolet }]}>+{latteMetrics.monthlyCost.toLocaleString()} {currency}/mois</Text>
          </View>
        </View>

        {/* Bouton Action Directe */}
        <TouchableOpacity style={styles.btnApply} onPress={handleApply}>
          <Text style={styles.btnApplyText}>
            🚀 Injecter ces +{totalDailyGain.toLocaleString()} {currency}/jour dans mon RAV
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 20
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 8
  },
  badgeText: {
    color: colors.accentEmerald,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18
  },
  heroCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.accentEmerald,
    marginBottom: 20
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentEmerald,
    letterSpacing: 0.8
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary
  },
  heroUnit: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentEmerald,
    marginLeft: 6
  },
  heroSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4
  },
  heroBold: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3
  },
  countBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted
  },
  subCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 10
  },
  subCardActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)'
  },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  subIcon: {
    fontSize: 18
  },
  subMeta: {},
  subName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subCost: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600'
  },
  subRec: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10
  },
  subGainPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  subGainText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentEmerald
  },
  latteCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 20
  },
  latteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  latteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary
  },
  lattePill: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)'
  },
  latteDesc: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 14
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  stepperLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  stepperVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 42,
    textAlign: 'center'
  },
  latteImpactBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  latteImpactLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentViolet
  },
  latteImpactSub: {
    fontSize: 9.5,
    color: colors.textSecondary,
    marginTop: 2
  },
  latteImpactVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accentViolet
  },
  btnApply: {
    backgroundColor: colors.accentEmerald,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.accentEmerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  btnApplyText: {
    color: '#07090E',
    fontSize: 14,
    fontWeight: '800'
  }
});
