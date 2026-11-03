import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { ExpenseRecord, DynamicPocketDefinition } from '@rav/engine';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

export const HistoryScreen: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [userPockets, setUserPockets] = useState<DynamicPocketDefinition[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [currency, setCurrency] = useState<string>('€');

  // État du modal de modification
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editPocketId, setEditPocketId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    const list = await StorageService.getLocalExpenses();
    setExpenses(list);

    const pockets = await StorageService.getLocalPockets();
    if (pockets && pockets.length > 0) {
      setUserPockets(pockets);
    }

    const user = currentUser || await StorageService.getCurrentUser();
    if (user && user.currency) {
      const symbolMap: Record<string, string> = {
        EUR: '€',
        FCFA: 'FCFA',
        USD: '$',
        CHF: 'CHF'
      };
      setCurrency(symbolMap[user.currency] || user.currency);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const spentToday = expenses.filter(e => e.date === todayStr).reduce((acc, curr) => acc + curr.amount, 0);

  // Détermination de la poche associée à une dépense
  const resolvePocket = (exp: ExpenseRecord) => {
    // 1. Recherche par ID direct dans les poches configurées
    const byId = userPockets.find(p => p.id === exp.pocketKey);
    if (byId) {
      return {
        id: byId.id,
        icon: byId.icon || '💼',
        name: byId.name,
        color: byId.colorHex || colors.accentEmerald
      };
    }

    // 2. Recherche par nom exact ou partiel
    const byName = userPockets.find(p => p.name.toLowerCase() === (exp.label || '').toLowerCase());
    if (byName) {
      return {
        id: byName.id,
        icon: byName.icon || '💼',
        name: byName.name,
        color: byName.colorHex || colors.accentEmerald
      };
    }

    // 3. Fallback sur les clés standard (FOOD, TRANSPORT, PLEASURE, CUSHION)
    const keyLower = String(exp.pocketKey).toLowerCase().replace('pocket_', '');
    const byKey = userPockets.find(p =>
      p.id.toLowerCase().includes(keyLower) ||
      p.name.toLowerCase().includes(keyLower)
    );
    if (byKey) {
      return {
        id: byKey.id,
        icon: byKey.icon || '💼',
        name: byKey.name,
        color: byKey.colorHex || colors.accentEmerald
      };
    }

    // 4. Si un libellé personnalisé a été renseigné lors de la saisie
    if (exp.label && exp.label !== 'Dépense') {
      return {
        id: exp.pocketKey,
        icon: '💼',
        name: exp.label,
        color: colors.accentEmerald
      };
    }

    // 5. Fallback si des poches existent
    if (userPockets.length > 0) {
      return {
        id: userPockets[0].id,
        icon: userPockets[0].icon || '🥗',
        name: userPockets[0].name,
        color: userPockets[0].colorHex || colors.accentEmerald
      };
    }

    return {
      id: exp.pocketKey,
      icon: '⚡',
      name: 'Dépense',
      color: colors.accentEmerald
    };
  };

  // Options dynamiques de filtres basées sur les poches réelles
  const filterOptions = [
    { key: 'ALL', label: 'Toutes' },
    ...userPockets.map(p => ({
      key: p.id,
      label: `${p.icon} ${p.name.split('&')[0].trim()}`
    }))
  ];

  const filteredExpenses = selectedFilter === 'ALL'
    ? expenses
    : expenses.filter(e => {
        const p = resolvePocket(e);
        return e.pocketKey === selectedFilter || p.id === selectedFilter || p.name === selectedFilter;
      });

  // Ouvrir le formulaire d'édition
  const handleOpenEditModal = (exp: ExpenseRecord) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const resolved = resolvePocket(exp);
    setEditingExpense(exp);
    setEditAmount(String(exp.amount));
    setEditPocketId(resolved.id || exp.pocketKey);
    setEditLabel(exp.label || resolved.name);
    setEditDate(exp.date);
    setIsEditModalVisible(true);
  };

  // Sauvegarder la correction
  const handleSaveCorrection = async () => {
    if (!editingExpense) return;
    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Veuillez saisir un montant supérieur à 0');
      return;
    }

    try {
      setIsSavingEdit(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}

      const targetPocket = userPockets.find(p => p.id === editPocketId);
      const pocketLabel = editLabel.trim() || targetPocket?.name || 'Dépense';

      // 1. Sauvegarde locale instantanée (0 ms de latence)
      await StorageService.updateExpenseLocally(editingExpense.id, {
        amount: numAmount,
        pocketKey: editPocketId,
        label: pocketLabel,
        date: editDate
      });

      // 2. Synchronisation API / PostgreSQL en tâche de fond
      ApiService.updateExpense(editingExpense.id, {
        amount: numAmount,
        pocketId: editPocketId,
        label: pocketLabel,
        expenseDate: editDate
      }).catch(err => console.warn('Sync update expense API:', err));

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

      // Mettre à jour l'état local dans l'écran
      setExpenses(prev =>
        prev.map(e => (e.id === editingExpense.id ? {
          ...e,
          amount: numAmount,
          pocketKey: editPocketId,
          label: pocketLabel,
          date: editDate
        } : e))
      );

      setIsEditModalVisible(false);
      setEditingExpense(null);
      showToast('✅ Dépense corrigée avec succès !');
    } catch (err) {
      console.warn('Erreur modification dépense:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Supprimer une dépense
  const handleDeleteExpense = async () => {
    if (!editingExpense) return;

    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (e) {}

      await StorageService.deleteExpenseLocally(editingExpense.id);
      ApiService.deleteExpense(editingExpense.id).catch(err => console.warn('Sync delete API:', err));

      setExpenses(prev => prev.filter(e => e.id !== editingExpense.id));
      setIsEditModalVisible(false);
      setEditingExpense(null);
      showToast('🗑️ Dépense supprimée');
    } catch (err) {
      console.warn('Erreur suppression:', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.bgDeep }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Toast de Notification */}
        {toastMessage ? (
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        ) : null}

        {/* En-tête */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Historique & Activité</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Cycle en cours • Touchez une dépense pour corriger</Text>
          </View>
          <View style={styles.cloudBadge}>
            <Text style={styles.cloudBadgeText}>☁️ Synchronisé</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
            <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>DÉPENSÉ CE CYCLE</Text>
            <Text style={[styles.kpiVal, { color: themeColors.textPrimary }]}>{totalSpent.toFixed(2)} {currency}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
            <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>AUJOURD'HUI</Text>
            <Text style={[styles.kpiVal, { color: themeColors.accentEmerald }]}>{spentToday.toFixed(2)} {currency}</Text>
          </View>
        </View>

        {/* Filtres par Poche Dynamiques */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {filterOptions.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterPill,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle },
                selectedFilter === f.key && styles.filterPillActive
              ]}
              onPress={() => setSelectedFilter(f.key)}
            >
              <Text style={[
                styles.filterPillText,
                { color: themeColors.textSecondary },
                selectedFilter === f.key && styles.filterPillTextActive
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste des Dépenses */}
        {filteredExpenses.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
            <Text style={{ fontSize: 30, marginBottom: 8 }}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>Aucune dépense dans cette rubrique</Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Vos achats saisis apparaîtront ici.</Text>
          </View>
        ) : (
          filteredExpenses.map(exp => {
            const p = resolvePocket(exp);
            return (
              <TouchableOpacity
                key={exp.id}
                style={[
                  styles.expenseRow,
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.borderSubtle,
                    borderLeftColor: p.color,
                    borderLeftWidth: 4
                  }
                ]}
                activeOpacity={0.7}
                onPress={() => handleOpenEditModal(exp)}
              >
                <View style={styles.expenseLeft}>
                  <Text style={styles.pocketIcon}>{p.icon}</Text>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={[styles.expenseLabel, { color: themeColors.textPrimary }]} numberOfLines={1}>{exp.label || p.name}</Text>
                    <Text style={[styles.expenseDate, { color: themeColors.textSecondary }]}>{exp.date} • {p.name}</Text>
                  </View>
                </View>

                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, { color: themeColors.textPrimary }]}>-{exp.amount.toFixed(2)} {currency}</Text>
                  <View style={[styles.editBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }]}>
                    <Text style={styles.editBadgeIcon}>✏️</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de Correction de Dépense */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            {/* Barre de titre du modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>✏️ Corriger la Dépense</Text>
                <Text style={styles.modalSub}>Modifiez le montant, la poche ou le libellé</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Champ Montant */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Montant ({currency})</Text>
              <TextInput
                style={styles.textInputLarge}
                keyboardType="numeric"
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>

            {/* Choix de la Poche / Rubrique */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Affecter à la Rubrique :</Text>
              <View style={styles.pocketsPickerRow}>
                {userPockets.map(pocket => {
                  const isSelected = editPocketId === pocket.id;
                  const borderCol = pocket.colorHex || colors.accentEmerald;

                  return (
                    <TouchableOpacity
                      key={pocket.id}
                      style={[
                        styles.pocketPickerItem,
                        isSelected && {
                          borderColor: borderCol,
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          borderWidth: 1.5
                        }
                      ]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (e) {}
                        setEditPocketId(pocket.id);
                        if (!editLabel || userPockets.some(p => p.name === editLabel)) {
                          setEditLabel(pocket.name);
                        }
                      }}
                    >
                      <Text style={styles.pocketPickerIcon}>{pocket.icon}</Text>
                      <Text
                        style={[
                          styles.pocketPickerName,
                          isSelected && { color: colors.accentEmerald, fontWeight: '700' }
                        ]}
                        numberOfLines={1}
                      >
                        {pocket.name.split('&')[0].trim()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Champ Libellé */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Libellé / Note (Optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="Ex: Restaurant midi, Carburant..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Champ Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date (AAAA-MM-JJ)</Text>
              <TextInput
                style={styles.textInput}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="2026-11-01"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Boutons d'Action */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnSaveEdit, isSavingEdit && styles.btnDisabled]}
                onPress={handleSaveCorrection}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator color="#07090E" size="small" />
                ) : (
                  <Text style={styles.btnSaveEditText}>💾 Enregistrer la correction</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnDeleteExpense}
                onPress={handleDeleteExpense}
              >
                <Text style={styles.btnDeleteExpenseText}>🗑️ Supprimer cette dépense</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgDeep },
  container: { padding: 20 },
  toastCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: colors.accentEmerald,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center'
  },
  toastText: { color: colors.accentEmerald, fontSize: 13, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  cloudBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  cloudBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentEmerald },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  kpiVal: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  filtersScroll: { flexDirection: 'row', marginBottom: 14 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: 6
  },
  filterPillActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  filterPillText: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },
  filterPillTextActive: { color: '#07090E', fontWeight: '800' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  expenseRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  pocketIcon: { fontSize: 20 },
  expenseLabel: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  expenseDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  expenseRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expenseAmount: { fontSize: 14.5, fontWeight: '800', color: colors.textPrimary },
  editBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  editBadgeIcon: { fontSize: 11 },

  // Styles Modal d'Édition
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.88)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  modalSub: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  textInputLarge: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: '800',
    color: colors.accentEmerald
  },
  textInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary
  },
  pocketsPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  pocketPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  pocketPickerIcon: { fontSize: 16 },
  pocketPickerName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  modalActions: { marginTop: 8, gap: 10 },
  btnSaveEdit: {
    backgroundColor: colors.accentEmerald,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.accentEmerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  btnSaveEditText: { color: '#07090E', fontSize: 14.5, fontWeight: '800' },
  btnDeleteExpense: {
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)'
  },
  btnDeleteExpenseText: { color: '#F87171', fontSize: 12.5, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 }
});
