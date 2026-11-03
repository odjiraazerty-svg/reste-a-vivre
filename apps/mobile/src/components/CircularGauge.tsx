import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface CircularGaugeProps {
  remainingDailyRav: number;
  totalDailyRav: number;
  currency?: string;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  remainingDailyRav,
  totalDailyRav,
  currency = '€'
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ratio = totalDailyRav > 0 ? Math.min(1, Math.max(0, remainingDailyRav / totalDailyRav)) : 0;
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={themeColors.accentEmerald} />
            <Stop offset="100%" stopColor={themeColors.accentCyan} />
          </LinearGradient>
        </Defs>

        {/* Cercle d'arrière-plan */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Jauge animée */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.innerContent}>
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>DISPONIBLE AUJOURD'HUI</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amount, { color: themeColors.textPrimary }]}>{remainingDailyRav.toFixed(2)}</Text>
          <Text style={[styles.currency, { color: themeColors.textSecondary }]}>{currency}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>● Dans le vert pour aujourd'hui</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    position: 'relative'
  },
  svg: {
    transform: [{ rotate: '0deg' }]
  },
  innerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  amount: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1.5
  },
  currency: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accentEmerald,
    marginLeft: 4
  },
  chip: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.accentEmerald
  }
});
