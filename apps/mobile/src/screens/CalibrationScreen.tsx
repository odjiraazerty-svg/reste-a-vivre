import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { RavFormulas } from '@rav/engine';
import { StorageService, UserProfileCalibration } from '../services/storage';
import { ApiService } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

export const CalibrationScreen: React.FC<{ currentUser?: any; onCalibrationSaved?: () => void }> = ({
  currentUser,
  onCalibrationSaved
}) => {
  const { theme, colors: themeColors, isDark, setTheme } = useTheme();
  const getSymbol = (c?: string) => {
    const symbolMap: Record<string, string> = {
      EUR: '€',
      FCFA: 'FCFA',
      USD: '$',
      CHF: 'CHF'
    };
    return c ? (symbolMap[c] || c) : '€';
  };

  const [currency, setCurrency] = useState(getSymbol(currentUser?.currency));
  const [income, setIncome] = useState('2400');
  const [fixedCharges, setFixedCharges] = useState('1250');
  const [savings, setSavings] = useState('200');
  const [payDay, setPayDay] = useState('28');
  const [strategy, setStrategy] = useState<'DYNAMIC_WEIGHT' | 'WEEKEND_PACK' | 'ROLLOVER'>('DYNAMIC_WEIGHT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. Devise
    if (currentUser && currentUser.currency) {
      setCurrency(getSymbol(currentUser.currency));
    } else {
      StorageService.getCurrentUser().then(user => {
        if (user && user.currency) {
          setCurrency(getSymbol(user.currency));
        }
      });
    }

    // 2. Charger les valeurs précédemment enregistrées si existantes
    StorageService.getProfileCalibration().then(calib => {
      if (calib) {
        if (calib.netIncome !== undefined) setIncome(String(calib.netIncome));
        if (calib.fixedChargesTotal !== undefined) setFixedCharges(String(calib.fixedChargesTotal));
        if (calib.sanctuarySavings !== undefined) setSavings(String(calib.sanctuarySavings));
        if (calib.payDayOfMonth !== undefined) setPayDay(String(calib.payDayOfMonth));
        if (calib.weekendStrategy) setStrategy(calib.weekendStrategy);
      }
    });
  }, [currentUser]);

  const numIncome = parseFloat(income) || 0;
  const numFixed = parseFloat(fixedCharges) || 0;
  const numSavings = parseFloat(savings) || 0;

  const ravm = RavFormulas.calculateInitialRavM(numIncome, numFixed, numSavings);
  const metrics = RavFormulas.computeCycleMetrics(parseInt(payDay) || 28);
  const isWeekend = [0, 6].includes(new Date().getDay());

  // Calcul dynamique selon la stratégie week-end
  const dailyRavToday = RavFormulas.calculateDailyRav({
    initialRavM: ravm,
    totalSpentPriorInCycle: 0,
    remainingDays: metrics.remainingDays,
    strategy: strategy,
    isWeekendToday: isWeekend
  });

  const dailyRavWeekday = RavFormulas.calculateDailyRav({
    initialRavM: ravm,
    totalSpentPriorInCycle: 0,
    remainingDays: metrics.remainingDays,
    strategy: strategy,
    isWeekendToday: false
  });

  const handleSave = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const numPayDay = parseInt(payDay) || 28;
    const computedDailyRav = Number(dailyRavToday);

    const calibrationData: UserProfileCalibration = {
      netIncome: numIncome,
      fixedChargesTotal: numFixed,
      sanctuarySavings: numSavings,
      payDayOfMonth: numPayDay,
      weekendStrategy: strategy,
      dailyRav: computedDailyRav,
      monthlyRav: ravm,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Sauvegarde locale instantanée à 0ms
      await StorageService.saveProfileCalibration(calibrationData);

      // 2. Synchronisation avec le backend Fastify / PostgreSQL
      await ApiService.calibrateCycle({
        declaredNetIncome: numIncome,
        totalFixedCharges: numFixed,
        sanctuarySavings: numSavings,
        payDayOfMonth: numPayDay,
        weekendStrategy: strategy
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

      setSaveSuccessMsg(
        `Flux enregistrés avec succès ! Votre Reste À Vivre est désormais de ${computedDailyRav} ${currency} / jour (${ravm.toFixed(2)} ${currency} sur le cycle).`
      );

      if (onCalibrationSaved) {
        onCalibrationSaved();
      }
    } catch (err: any) {
      console.warn('Erreur sauvegarde calibration:', err);
      // Même en cas d'erreur réseau, la sauvegarde locale est effective
      setSaveSuccessMsg(
        `Flux enregistrés en local ! Reste À Vivre calibré à ${computedDailyRav} ${currency} / jour.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.bgDeep }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.screenTitle, { color: themeColors.textPrimary }]}>Calibration des Flux</Text>
        <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>
          Modélisez votre Reste À Vivre sans liaison bancaire obligatoire.
        </Text>

        {/* Salaire Net */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Revenu Net Mensuel ({currency})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.bgInput, borderColor: themeColors.borderSubtle, color: themeColors.textPrimary }]}
            keyboardType="numeric"
            value={income}
            onChangeText={setIncome}
          />
        </View>

        {/* Charges Fixes */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Charges Fixes Incompressibles ({currency})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.bgInput, borderColor: themeColors.borderSubtle, color: themeColors.textPrimary }]}
            keyboardType="numeric"
            value={fixedCharges}
            onChangeText={setFixedCharges}
          />
        </View>

        {/* Épargne Sanctuarisée */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Épargne Sanctuarisée (« Pay Yourself First ») ({currency})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.bgInput, borderColor: themeColors.borderSubtle, color: themeColors.textPrimary }]}
            keyboardType="numeric"
            value={savings}
            onChangeText={setSavings}
          />
        </View>

        {/* Date de Paie */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Jour de versement de la paie (1-31)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.bgInput, borderColor: themeColors.borderSubtle, color: themeColors.textPrimary }]}
            keyboardType="numeric"
            value={payDay}
            onChangeText={setPayDay}
          />
        </View>

        {/* Stratégie Week-end */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Stratégie Week-end & Loisirs</Text>
          {[
            { key: 'DYNAMIC_WEIGHT', label: 'Pondération Dynamique (w=2.0)' },
            { key: 'WEEKEND_PACK', label: 'Pack Week-end (Coffre Dédié 40%)' },
            { key: 'ROLLOVER', label: 'Rollover Économies' }
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.strategyBtn,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: themeColors.borderSubtle },
                strategy === item.key && styles.strategyBtnActive
              ]}
              onPress={() => setStrategy(item.key as any)}
            >
              <Text style={[
                styles.strategyText,
                { color: themeColors.textSecondary },
                strategy === item.key && styles.strategyTextActive
              ]}>
                {strategy === item.key ? '● ' : '○ '}{item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sélecteur de Thème d'Affichage (Fond Blanc ou Nuit) */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>🎨 Thème d'affichage</Text>
          <View style={styles.themeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.themeCardOption,
                {
                  backgroundColor: theme === 'dark' ? 'rgba(139, 92, 246, 0.2)' : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9'),
                  borderColor: theme === 'dark' ? themeColors.accentViolet : themeColors.borderSubtle
                }
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
                setTheme('dark');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.themeCardOptionIcon}>🌙</Text>
              <View>
                <Text style={[
                  styles.themeCardOptionTitle,
                  { color: themeColors.textPrimary },
                  theme === 'dark' && { color: themeColors.accentViolet, fontWeight: '800' }
                ]}>
                  Mode Nuit
                </Text>
                <Text style={[styles.themeCardOptionSub, { color: themeColors.textMuted }]}>
                  Sombre & immersif
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeCardOption,
                {
                  backgroundColor: theme === 'light' ? 'rgba(16, 185, 129, 0.16)' : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9'),
                  borderColor: theme === 'light' ? themeColors.accentEmerald : themeColors.borderSubtle
                }
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
                setTheme('light');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.themeCardOptionIcon}>☀️</Text>
              <View>
                <Text style={[
                  styles.themeCardOptionTitle,
                  { color: themeColors.textPrimary },
                  theme === 'light' && { color: themeColors.accentEmerald, fontWeight: '800' }
                ]}>
                  Fond Blanc
                </Text>
                <Text style={[styles.themeCardOptionSub, { color: themeColors.textMuted }]}>
                  Clair & reposant
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Message de Succès de Sauvegarde */}
        {saveSuccessMsg ? (
          <View style={styles.successBanner}>
            <View style={styles.successBannerHeader}>
              <Text style={styles.successBannerIcon}>✅</Text>
              <Text style={styles.successBannerTitle}>Configuration Enregistrée !</Text>
              <TouchableOpacity onPress={() => setSaveSuccessMsg(null)}>
                <Text style={styles.successBannerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.successBannerText}>{saveSuccessMsg}</Text>
          </View>
        ) : null}

        {/* Preview Direct */}
        <View style={[styles.previewBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.12)', borderColor: themeColors.borderSubtle }]}>
          <View>
            <Text style={[styles.previewLabel, { color: themeColors.textMuted }]}>RAVm Mensuel</Text>
            <Text style={[styles.previewVal, { color: themeColors.textPrimary }]}>{ravm.toFixed(2)} {currency}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.previewLabel, { color: themeColors.textMuted }]}>
              {isWeekend && strategy === 'DYNAMIC_WEIGHT' ? "RAVq Aujourd'hui (Week-end x2)" : "RAVq Journalier Estimé"}
            </Text>
            <Text style={[styles.previewVal, { color: isWeekend && strategy === 'DYNAMIC_WEIGHT' ? themeColors.accentViolet : themeColors.accentEmerald }]}>
              {dailyRavToday.toFixed(2)} {currency}/j
            </Text>
          </View>
        </View>

        {isWeekend && strategy === 'DYNAMIC_WEIGHT' ? (
          <View style={styles.weekendHintCard}>
            <Text style={styles.weekendHintText}>
              🎉 <Text style={{ fontWeight: '800' }}>Dimanche détecté</Text> : Pondération active (w=2.0). Votre budget d'aujourd'hui est de <Text style={{ fontWeight: '800', color: colors.accentViolet }}>{dailyRavToday.toFixed(2)} {currency}</Text> (contre ~{dailyRavWeekday.toFixed(2)} {currency} en semaine).
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#07090E" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>💾 Sauvegarder & Recalculer mon RAV</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgDeep },
  container: { padding: 20 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  screenSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.accentEmerald,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: colors.accentEmerald,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  successBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  successBannerIcon: {
    fontSize: 18,
    marginRight: 8
  },
  successBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accentEmerald,
    flex: 1
  },
  successBannerClose: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: 6
  },
  successBannerText: {
    fontSize: 12.5,
    color: colors.textPrimary,
    lineHeight: 18,
    fontWeight: '500'
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    padding: 10
  },
  strategyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 6
  },
  strategyBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentViolet
  },
  strategyText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600' },
  strategyTextActive: { color: colors.accentViolet, fontWeight: '700' },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  themeCardOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  themeCardOptionIcon: {
    fontSize: 22
  },
  themeCardOptionTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  themeCardOptionSub: {
    fontSize: 10,
    marginTop: 1
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 18,
    padding: 16,
    marginVertical: 14
  },
  previewLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  previewVal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  weekendHintCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14
  },
  weekendHintText: {
    color: '#DDD6FE',
    fontSize: 12,
    lineHeight: 16
  },
  saveBtn: {
    backgroundColor: colors.accentEmerald,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  saveBtnDisabled: {
    opacity: 0.7
  },
  saveBtnText: { color: '#07090E', fontWeight: '800', fontSize: 15 }
});
