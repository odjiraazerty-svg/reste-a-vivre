import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DynamicPocketDefinition, RavPockets } from '@rav/engine';
import { colors } from '../theme/colors';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';

const EMOJI_PRESETS = ['🥗', '🚗', '☕', '🛡️', '🛒', '👶', '🐕', '🎮', '🏋️', '📚', '🛍️', '✈️', '💊', '🎉'];
const COLOR_PRESETS = ['#10B981', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#3B82F6'];

interface PocketsManagementModalProps {
  visible: boolean;
  onClose: () => void;
  pockets: DynamicPocketDefinition[];
  onPocketsUpdated: (newPockets: DynamicPocketDefinition[]) => void;
}

export const PocketsManagementModal: React.FC<PocketsManagementModalProps> = ({
  visible,
  onClose,
  pockets = [],
  onPocketsUpdated
}) => {
  const safePockets = Array.isArray(pockets) && pockets.length > 0 ? pockets : RavPockets.getDefaultPockets();
  const [items, setItems] = useState<DynamicPocketDefinition[]>(safePockets);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🛒');
  const [selectedColor, setSelectedColor] = useState('#10B981');
  const [newPercentage, setNewPercentage] = useState(0.15);

  React.useEffect(() => {
    if (Array.isArray(pockets) && pockets.length > 0) {
      setItems(pockets);
    }
  }, [pockets]);

  const validation = RavPockets.validateAllocations(items || []);
  const totalPct = Math.round((validation?.totalPercentage || 0) * 100);

  const notifyChange = async (updated: DynamicPocketDefinition[]) => {
    setItems(updated);
    onPocketsUpdated(updated);
    await StorageService.saveLocalPockets(updated);

    // Synchronisation en tâche de fond avec PostgreSQL
    updated.forEach((p) => {
      if (p.id.startsWith('pocket_custom_')) {
        ApiService.createPocket({
          name: p.name,
          icon: p.icon,
          colorHex: p.colorHex || '#10B981',
          targetPercentage: p.targetPercentage,
          displayOrder: p.displayOrder
        }).catch(() => {});
      } else {
        ApiService.updatePocket(p.id, {
          targetPercentage: p.targetPercentage,
          displayOrder: p.displayOrder
        }).catch(() => {});
      }
    });
  };

  const handleAdjustPct = (id: string, delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const updated = items.map((p) => {
      if (p.id === id) {
        const next = Math.max(0.05, Math.min(0.90, Number((p.targetPercentage + delta).toFixed(2))));
        return { ...p, targetPercentage: next };
      }
      return p;
    });

    notifyChange(updated);
  };

  const handleAutoRebalance = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    const balanced = RavPockets.autoBalanceWithCushion(items);
    notifyChange(balanced);
  };

  const handleArchivePocket = (id: string, name: string) => {
    Alert.alert(
      'Archiver la poche',
      `Êtes-vous sûr de vouloir archiver "${name}" ? L'historique de vos dépenses passées sera préservé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {}

            const updated = items.filter((p) => p.id !== id);
            const rebalanced = RavPockets.autoBalanceWithCushion(updated);
            notifyChange(rebalanced);
            ApiService.archivePocket(id).catch(() => {});
          }
        }
      ]
    );
  };

  const handleCreatePocket = () => {
    if (!newName.trim()) {
      Alert.alert('Nom requis', 'Veuillez saisir un nom pour cette poche.');
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    const newPocket: DynamicPocketDefinition = {
      id: 'pocket_custom_' + Date.now(),
      name: newName.trim(),
      icon: selectedIcon,
      colorHex: selectedColor,
      targetPercentage: newPercentage,
      displayOrder: items.length + 1,
      isSystemDefault: false,
      isArchived: false
    };

    const combined = [...items, newPocket];
    const balanced = RavPockets.autoBalanceWithCushion(combined);

    notifyChange(balanced);
    setNewName('');
    setShowAddForm(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>⚙️ Vos Poches Dynamiques</Text>
              <Text style={styles.subTitle}>Personnalisez vos quotas et enveloppes</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de quota total */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>Total des parts allouées :</Text>
              <Text style={[styles.summaryVal, totalPct === 100 ? { color: colors.accentEmerald } : { color: colors.accentViolet }]}>
                {totalPct}% / 100%
              </Text>
            </View>
            <TouchableOpacity style={styles.btnAutoBalance} onPress={handleAutoRebalance}>
              <Text style={styles.btnAutoBalanceText}>🪄 Équilibrer</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
            {/* Liste des poches actives */}
            {items.map((p) => {
              const pct = Math.round(p.targetPercentage * 100);
              const color = p.colorHex || colors.accentEmerald;

              return (
                <View key={p.id} style={[styles.pocketRow, { borderLeftColor: color, borderLeftWidth: 4 }]}>
                  <View style={styles.pocketInfo}>
                    <Text style={styles.pocketIcon}>{p.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pocketName} numberOfLines={1}>{p.name}</Text>
                      {p.isSystemDefault ? (
                        <Text style={styles.systemTag}>🛡️ Tampon automatique</Text>
                      ) : (
                        <Text style={styles.userTag}>Personnalisée</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.controlsRow}>
                    <TouchableOpacity
                      style={styles.btnDelta}
                      onPress={() => handleAdjustPct(p.id, -0.05)}
                      disabled={p.targetPercentage <= 0.05}
                    >
                      <Text style={styles.btnDeltaText}>-5%</Text>
                    </TouchableOpacity>

                    <Text style={[styles.pctDisplay, { color }]}>{pct}%</Text>

                    <TouchableOpacity
                      style={styles.btnDelta}
                      onPress={() => handleAdjustPct(p.id, +0.05)}
                      disabled={p.targetPercentage >= 0.85}
                    >
                      <Text style={styles.btnDeltaText}>+5%</Text>
                    </TouchableOpacity>

                    {!p.isSystemDefault && (
                      <TouchableOpacity
                        style={styles.btnDelete}
                        onPress={() => handleArchivePocket(p.id, p.name)}
                      >
                        <Text style={styles.btnDeleteText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Formulaire de création de poche */}
            {showAddForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Créer une nouvelle poche</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Nom de la poche (ex: Animaux, Cigarettes...)"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                />

                {/* Sélecteur d'icônes */}
                <Text style={styles.labelField}>Icône :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                  {EMOJI_PRESETS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.emojiBtn, selectedIcon === emoji && styles.emojiBtnActive]}
                      onPress={() => setSelectedIcon(emoji)}
                    >
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Sélecteur de couleur */}
                <Text style={styles.labelField}>Couleur de la poche :</Text>
                <View style={styles.colorsRow}>
                  {COLOR_PRESETS.map((col) => (
                    <TouchableOpacity
                      key={col}
                      style={[styles.colorBtn, { backgroundColor: col }, selectedColor === col && styles.colorBtnActive]}
                      onPress={() => setSelectedColor(col)}
                    />
                  ))}
                </View>

                {/* Choix de la part */}
                <Text style={styles.labelField}>Part du RAV allouée : {Math.round(newPercentage * 100)}%</Text>
                <View style={styles.quickPctRow}>
                  {[0.10, 0.15, 0.20, 0.25].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.quickPctBtn, newPercentage === val && styles.quickPctBtnActive]}
                      onPress={() => setNewPercentage(val)}
                    >
                      <Text style={styles.quickPctText}>{Math.round(val * 100)}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Boutons d'action du formulaire */}
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAddForm(false)}>
                    <Text style={styles.btnCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSubmit} onPress={handleCreatePocket}>
                    <Text style={styles.btnSubmitText}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.btnAddTrigger}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.btnAddTriggerIcon}>➕</Text>
                <Text style={styles.btnAddTriggerText}>Créer une nouvelle poche</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.92)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#0F1523',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  summaryBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  summaryLeft: {
    flexDirection: 'column'
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800'
  },
  btnAutoBalance: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)'
  },
  btnAutoBalanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentViolet
  },
  listScroll: {
    marginBottom: 10
  },
  pocketRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  pocketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  pocketIcon: {
    fontSize: 22,
    marginRight: 10
  },
  pocketName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  systemTag: {
    fontSize: 10.5,
    color: colors.accentViolet,
    fontWeight: '600',
    marginTop: 2
  },
  userTag: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8
  },
  btnDelta: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  btnDeltaText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  pctDisplay: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 42,
    textAlign: 'center'
  },
  btnDelete: {
    marginLeft: 6,
    padding: 4
  },
  btnDeleteText: {
    fontSize: 14
  },
  btnAddTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderStyle: 'dashed',
    marginTop: 6,
    marginBottom: 20
  },
  btnAddTriggerIcon: {
    fontSize: 16,
    marginRight: 8
  },
  btnAddTriggerText: {
    color: colors.accentEmerald,
    fontWeight: '700',
    fontSize: 14
  },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  labelField: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '600'
  },
  emojiRow: {
    marginBottom: 12
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1.5,
    borderColor: colors.accentEmerald
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  colorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  colorBtnActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }]
  },
  quickPctRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  quickPctBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  quickPctBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: colors.accentEmerald
  },
  quickPctText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12
  },
  formActions: {
    flexDirection: 'row',
    gap: 10
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    alignItems: 'center'
  },
  btnCancelText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 13
  },
  btnSubmit: {
    flex: 2,
    paddingVertical: 12,
    backgroundColor: colors.accentEmerald,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnSubmitText: {
    color: '#061A14',
    fontWeight: '800',
    fontSize: 13.5
  }
});

