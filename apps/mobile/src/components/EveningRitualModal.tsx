import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { PocketType, RavPockets } from '@rav/engine';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface EveningRitualModalProps {
  visible: boolean;
  onClose: () => void;
  allocatedDailyRav: number;
  spentTodayByPocket: Partial<Record<PocketType, number>>;
  currency?: string;
  onComplete: (adjustments: Record<PocketType, number>, transferSurplusToWeekend: boolean) => void;
}

export const EveningRitualModal: React.FC<EveningRitualModalProps> = ({
  visible,
  onClose,
  allocatedDailyRav,
  spentTodayByPocket,
  currency = '€',
  onComplete
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [adjustments, setAdjustments] = useState<Record<PocketType, number>>({
    FOOD: 0,
    TRANSPORT: 0,
    PLEASURE: 0,
    CUSHION: 0
  });

  useEffect(() => {
    if (visible) {
      setAdjustments({
        FOOD: spentTodayByPocket.FOOD || 0,
        TRANSPORT: spentTodayByPocket.TRANSPORT || 0,
        PLEASURE: spentTodayByPocket.PLEASURE || 0,
        CUSHION: spentTodayByPocket.CUSHION || 0
      });
    }
  }, [visible, spentTodayByPocket]);

  const pockets = RavPockets.distribute(allocatedDailyRav);

  const handleStep = (pocketKey: PocketType, delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }

    setAdjustments((prev) => ({
      ...prev,
      [pocketKey]: Math.max(0, Number((prev[pocketKey] + delta).toFixed(2)))
    }));
  };

  const totalSpent = Object.values(adjustments).reduce((sum, v) => sum + v, 0);
  const diff = Number((allocatedDailyRav - totalSpent).toFixed(2));
  const hasSurplus = diff >= 0;

  const handleFinish = (transferSurplus: boolean) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { }
    onComplete(adjustments, transferSurplus);
    onClose();
  };

  const pocketMeta: Record<PocketType, { icon: string; name: string }> = {
    FOOD: { icon: '🥗', name: 'Repas & Courses' },
    TRANSPORT: { icon: '🚗', name: 'Mobilité & Trajets' },
    PLEASURE: { icon: '☕', name: 'Plaisirs & Cafés' },
    CUSHION: { icon: '🛡️', name: 'Coussin Sécurité' }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={[styles.overlay, { backgroundColor: isDark ? 'rgba(7, 9, 14, 0.96)' : 'rgba(15, 23, 42, 0.65)' }]}>
        <ScrollView contentContainerStyle={[styles.content, { backgroundColor: themeColors.bgSurface, borderColor: themeColors.borderSubtle }]}>
          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={styles.badge}>LE BILAN À 20H30 🌙</Text>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>Clôture de la Journée</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: themeColors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.intro, { color: themeColors.textSecondary }]}>
            Ajustez rapidement vos 4 poches en quelques secondes. Vos charges fixes et votre épargne restent 100% protégées.
          </Text>

          {/* Ajusteurs des 4 poches */}
          {(['FOOD', 'TRANSPORT', 'PLEASURE', 'CUSHION'] as PocketType[]).map((key) => {
            const meta = pocketMeta[key];
            const alloc = pockets[key].allocatedAmount;
            const currentVal = adjustments[key] || 0;

            return (
              <View key={key} style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
                <View style={styles.cardLeft}>
                  <Text style={styles.icon}>{meta.icon}</Text>
                  <View>
                    <Text style={[styles.name, { color: themeColors.textPrimary }]}>{meta.name}</Text>
                    <Text style={[styles.allocated, { color: themeColors.textMuted }]}>Alloué : {alloc.toFixed(2)} {currency}</Text>
                  </View>
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} onPress={() => handleStep(key, -5)}>
                    <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>-5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} onPress={() => handleStep(key, -1)}>
                    <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>-1</Text>
                  </TouchableOpacity>
                  <Text style={[styles.valDisplay, { color: themeColors.textPrimary }]}>{currentVal.toFixed(2)}</Text>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} onPress={() => handleStep(key, 1)}>
                    <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} onPress={() => handleStep(key, 5)}>
                    <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>+5</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Bilan du Jour */}
          <View style={[styles.outcomeBox, !hasSurplus && styles.outcomeDeficit]}>
            <View style={styles.outcomeTop}>
              <Text style={[styles.outcomeTitle, !hasSurplus && { color: colors.accentAmber }]}>
                {hasSurplus ? 'Bravo ! Économies Réalisées ✨' : 'Amortissement Automatique 🛡️'}
              </Text>
              <Text style={styles.outcomeAmount}>
                {hasSurplus ? `+${diff.toFixed(2)}` : `-${Math.abs(diff).toFixed(2)}`} {currency}
              </Text>
            </View>
            <Text style={styles.outcomeDesc}>
              {hasSurplus
                ? `Excellente journée ! Vous avez consommé moins que prévu. Vous pouvez transférer vos ${diff.toFixed(2)} ${currency} d'avance au Pack Week-end.`
                : `Dépassement doux de ${Math.abs(diff).toFixed(2)} ${currency} étalé sur les jours restants. Vos charges fixes sont totalement préservées.`}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {hasSurplus && (
              <TouchableOpacity
                style={styles.btnWeekend}
                onPress={() => handleFinish(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnWeekendText}>
                  🏖️ Transférer mes +{diff.toFixed(2)} {currency} au Pack Week-end
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.btnConfirm}
              onPress={() => handleFinish(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnConfirmText}>✨ Valider ma Journée & Dormir Paisiblement</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 18, 0.98)'
  },
  content: {
    padding: 20,
    paddingBottom: 50
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  badge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#A5B4FC',
    letterSpacing: 0.6
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  intro: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  icon: {
    fontSize: 20
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  allocated: {
    fontSize: 10.5,
    color: colors.textMuted
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  stepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8
  },
  stepText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700'
  },
  valDisplay: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center'
  },
  outcomeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 18,
    padding: 16,
    marginVertical: 14
  },
  outcomeDeficit: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  outcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  outcomeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accentEmerald
  },
  outcomeAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary
  },
  outcomeDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16
  },
  actions: {
    gap: 10,
    marginTop: 6
  },
  btnWeekend: {
    backgroundColor: colors.accentViolet,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center'
  },
  btnWeekendText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5
  },
  btnConfirm: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 13,
    alignItems: 'center'
  },
  btnConfirmText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13
  }
});
