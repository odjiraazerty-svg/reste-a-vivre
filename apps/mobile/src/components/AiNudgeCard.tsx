import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AiNudgeCard as AiNudgeCardType } from '@rav/engine';
import { colors } from '../theme/colors';

interface AiNudgeCardProps {
  nudge: AiNudgeCardType;
}

export const AiNudgeCard: React.FC<AiNudgeCardProps> = ({ nudge }) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>💡</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{nudge.title}</Text>
        <Text style={styles.message}>{nudge.message}</Text>
        {nudge.potentialDailyGain > 0 && (
          <View style={styles.gainBadge}>
            <Text style={styles.gainText}>+{nudge.potentialDailyGain.toFixed(2)} €/jour</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    fontSize: 18
  },
  content: {
    flex: 1
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentViolet,
    marginBottom: 2
  },
  message: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 16,
    marginBottom: 6
  },
  gainBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  gainText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.accentEmerald
  }
});
