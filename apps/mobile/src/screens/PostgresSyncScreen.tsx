import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { colors } from '../theme/colors';

export const PostgresSyncScreen: React.FC = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState('SYNCED');
  const [lastSyncTime, setLastSyncTime] = useState<string>('À l\'instant');

  const refreshPending = async () => {
    const queue = await StorageService.getPendingSyncQueue();
    setPendingCount(queue.length);
  };

  useEffect(() => {
    refreshPending();
  }, []);

  const handleManualSync = async () => {
    setSyncStatus('SYNCING...');
    const res = await ApiService.syncPendingExpenses();
    if (res.error) {
      setSyncStatus('OFFLINE_RETRY');
    } else {
      setSyncStatus('SYNCED');
      setLastSyncTime(new Date().toLocaleTimeString());
      setPendingCount(0);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🐘 PostgreSQL 16+ • Synchronisation ACID</Text>
        </View>

        <Text style={styles.title}>Synchronisation PostgreSQL</Text>
        <Text style={styles.subtitle}>
          Vos dépenses sont écrites à 0 ms en local sur le téléphone et transmises de façon idempotente vers la table relationnelle expenses.
        </Text>

        {/* Métriques */}
        <View style={styles.statCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>État du Pool PostgreSQL</Text>
            <Text style={[styles.statValue, { color: colors.accentEmerald }]}>● ACTIF (10/10 Connexions)</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Transactions en attente de sync</Text>
            <Text style={[styles.statValue, { color: pendingCount > 0 ? colors.accentAmber : colors.accentCyan }]}>
              {pendingCount} transaction(s)
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Dernière synchronisation</Text>
            <Text style={styles.statValue}>{lastSyncTime}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Garantie Idempotence</Text>
            <Text style={styles.statValue}>UUID client_sync_id UNIQUE</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.syncBtn} onPress={handleManualSync} activeOpacity={0.8}>
          <Text style={styles.syncBtnText}>🔄 Forcer la Synchronisation Immédiate</Text>
        </TouchableOpacity>

        {/* Aperçu du Schéma SQL */}
        <View style={styles.schemaBox}>
          <Text style={styles.schemaTitle}>Structure Table expenses (PostgreSQL) :</Text>
          <Text style={styles.sqlCode}>
{`CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  cycle_id UUID REFERENCES cycles(id),
  pocket_key VARCHAR(30) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  client_sync_id UUID UNIQUE,
  expense_date DATE DEFAULT CURRENT_DATE
);`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgDeep },
  container: { padding: 20 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(51, 103, 145, 0.2)',
    borderColor: 'rgba(51, 103, 145, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    marginBottom: 10
  },
  badgeText: { color: '#336791', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  statCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
    gap: 12,
    marginBottom: 16
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  statValue: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  syncBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  syncBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  schemaBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  schemaTitle: { fontSize: 11.5, fontWeight: '700', color: colors.accentCyan, marginBottom: 8 },
  sqlCode: { fontFamily: 'Courier', fontSize: 11, color: '#94A3B8', lineHeight: 16 }
});
