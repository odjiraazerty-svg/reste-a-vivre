import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PocketConfig } from '@rav/engine';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface PocketCardProps {
  pocket: PocketConfig;
  currency?: string;
  onPress?: () => void;
}

export const PocketCard: React.FC<PocketCardProps> = ({ pocket, currency = '€', onPress }) => {
  const { colors: themeColors, isDark } = useTheme();

  const accentColors: Record<string, string> = {
    FOOD: themeColors.pocketFood,
    TRANSPORT: themeColors.pocketTransport,
    PLEASURE: themeColors.pocketPleasure,
    CUSHION: themeColors.pocketCushion
  };

  const color = pocket.colorHex || (pocket.key ? accentColors[pocket.key] : null) || themeColors.accentEmerald;
  const progressRatio = pocket.allocatedAmount > 0
    ? Math.min(1, pocket.spentAmount / pocket.allocatedAmount)
    : 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.bgCard,
          borderColor: themeColors.borderSubtle,
          borderLeftColor: color,
          borderLeftWidth: 3.5
        }
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <Text style={styles.icon}>{pocket.icon}</Text>
        <View style={styles.topRight}>
          <Text style={[styles.quota, { color: themeColors.textMuted }]}>{Math.round(pocket.targetPercentage * 100)}%</Text>
          <View style={[styles.tapBadge, { borderColor: color, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' }]}>
            <Text style={[styles.tapBadgeText, { color }]}>+ Saisir</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={1}>{pocket.name}</Text>

      <View style={styles.balanceRow}>
        <Text style={[styles.remaining, { color: themeColors.textPrimary }]}>{pocket.remainingAmount.toFixed(2)} {currency}</Text>
        <Text style={[styles.allocated, { color: themeColors.textMuted }]}>/ {pocket.allocatedAmount.toFixed(2)}</Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }]}>
        <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: color }]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flex: 1,
    margin: 5
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  icon: {
    fontSize: 18
  },
  quota: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted
  },
  tapBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)'
  },
  tapBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  title: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8
  },
  remaining: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  allocated: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 3
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 99,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 99
  }
});
