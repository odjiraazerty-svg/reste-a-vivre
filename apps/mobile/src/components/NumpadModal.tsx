import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DynamicPocketDefinition, PocketConfig } from '@rav/engine';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface NumpadModalProps {
  visible: boolean;
  onClose: () => void;
  onValidate: (pocketKey: any, amount: number, pocketName?: string) => void;
  pockets?: (DynamicPocketDefinition | PocketConfig)[];
  currency?: string;
  initialPocket?: any;
}

export const NumpadModal: React.FC<NumpadModalProps> = ({
  visible,
  onClose,
  onValidate,
  pockets,
  currency = '€',
  initialPocket = null
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [buffer, setBuffer] = useState('0');
  const [targetPocket, setTargetPocket] = useState<any>(null);

  useEffect(() => {
    setTargetPocket(initialPocket || null);
    if (visible) {
      setBuffer('0');
    }
  }, [initialPocket, visible]);

  const defaultPockets = [
    { id: 'pocket_food', name: 'Repas', icon: '🥗', colorHex: colors.pocketFood },
    { id: 'pocket_transport', name: 'Transport', icon: '🚗', colorHex: colors.pocketTransport },
    { id: 'pocket_pleasure', name: 'Plaisirs', icon: '☕', colorHex: colors.pocketPleasure },
    { id: 'pocket_cushion', name: 'Coussin', icon: '🛡️', colorHex: colors.pocketCushion }
  ];

  const activePockets = (pockets && pockets.length > 0) ? pockets : defaultPockets;

  const handleKeyPress = (char: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }

    if (buffer === '0' && char !== '.') {
      setBuffer(char);
    } else {
      if (char === '.' && buffer.includes('.')) return;
      if (buffer.length < 7) {
        setBuffer(buffer + char);
      }
    }
  };

  const handleBackspace = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }

    if (buffer.length > 1) {
      setBuffer(buffer.slice(0, -1));
    } else {
      setBuffer('0');
    }
  };

  const handleQuickChip = (amount: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) { }
    setBuffer(amount);
  };

  const handlePocketSubmit = (pocket: any) => {
    const num = parseFloat(buffer);
    if (!isNaN(num) && num > 0) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) { }
      const pKey = pocket.id || pocket.key;
      const pName = pocket.name || 'Dépense';
      onValidate(pKey, num, pName);
      setBuffer('0');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={[styles.overlay, { backgroundColor: isDark ? 'rgba(7, 9, 14, 0.96)' : 'rgba(15, 23, 42, 0.65)' }]}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.bgSurface, borderColor: themeColors.borderSubtle }]}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                {targetPocket ? `⚡ Dépense • ${targetPocket.icon} ${targetPocket.name}` : '⚡ Saisie Express « 2-Taps »'}
              </Text>
              {targetPocket ? (
                <Text style={styles.subtitleTarget}>Poche sélectionnée au toucher</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: themeColors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Montant saisi en gros */}
          <View style={[styles.amountBox, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F8FAFC', borderColor: themeColors.borderSubtle }]}>
            <Text style={[styles.amountVisual, { color: themeColors.textPrimary }]}>{buffer} <Text style={[styles.currVisual, { color: themeColors.accentEmerald }]}>{currency}</Text></Text>
            <Text style={[styles.hint, { color: themeColors.textMuted }]}>
              {targetPocket
                ? 'Tapez le montant puis validez ci-dessous'
                : '1. Tapez le montant • 2. Touchez une poche ci-dessous'}
            </Text>
          </View>

          {/* Puces rapides */}
          <View style={styles.chipsRow}>
            {['1.50', '8.50', '15.00', '30.00'].map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[styles.chip, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9', borderColor: themeColors.borderSubtle }]}
                onPress={() => handleQuickChip(amt)}
              >
                <Text style={[styles.chipText, { color: themeColors.textPrimary }]}>+{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pavé Numérique */}
          <View style={styles.numpad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', '⌫']].map((row, rIdx) => (
              <View key={rIdx} style={styles.numpadRow}>
                {row.map((btn) => (
                  <TouchableOpacity
                    key={btn}
                    style={[styles.keyBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: themeColors.borderSubtle }]}
                    onPress={() => (btn === '⌫' ? handleBackspace() : handleKeyPress(btn))}
                  >
                    <Text style={[styles.keyText, { color: themeColors.textPrimary }]}>{btn}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Bouton de validation directe si poche pré-sélectionnée */}
          {targetPocket ? (
            <TouchableOpacity
              style={[
                styles.btnDirectValidate,
                { backgroundColor: targetPocket.colorHex || colors.accentEmerald },
                parseFloat(buffer) <= 0 && styles.btnDirectValidateDisabled
              ]}
              onPress={() => handlePocketSubmit(targetPocket)}
              disabled={parseFloat(buffer) <= 0}
              activeOpacity={0.8}
            >
              <Text style={styles.btnDirectValidateText}>
                ✅ Valider dans {targetPocket.icon} {targetPocket.name}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Poches Directes Dynamiques (pour choisir ou changer) */}
          <Text style={styles.secondTapTitle}>
            {targetPocket ? 'OU CHANGER DE POCHE :' : '👉 2ÈME TAP : VALIDER DIRECTEMENT DANS :'}
          </Text>
          <View style={styles.pocketValidationGrid}>
            {activePockets.map((p) => {
              const borderCol = p.colorHex || colors.accentEmerald;
              const shortName = p.name.split('&')[0].trim();
              const isSelected = targetPocket && (targetPocket.id === p.id || targetPocket.name === p.name);

              return (
                <TouchableOpacity
                  key={p.id || p.name}
                  style={[
                    styles.pocketBtn,
                    { borderColor: borderCol },
                    isSelected && {
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => handlePocketSubmit(p)}
                >
                  <Text style={styles.pIcon}>{p.icon}</Text>
                  <Text style={[styles.pLabel, isSelected && { fontWeight: '800', color: colors.textPrimary }]} numberOfLines={1}>
                    {shortName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.96)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    padding: 20,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitleTarget: {
    fontSize: 11,
    color: colors.accentEmerald,
    fontWeight: '600',
    marginTop: 2
  },
  closeBtn: {
    padding: 6
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: 'bold'
  },
  amountBox: {
    alignItems: 'center',
    marginVertical: 6,
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  amountVisual: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary
  },
  currVisual: {
    fontSize: 18,
    color: colors.accentEmerald,
    fontWeight: '700'
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  chip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 7,
    marginHorizontal: 3,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  numpad: {
    marginBottom: 10
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  keyBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  keyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  btnDirectValidate: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnDirectValidateDisabled: {
    opacity: 0.5
  },
  btnDirectValidateText: {
    color: '#07090E',
    fontSize: 14,
    fontWeight: '800'
  },
  secondTapTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6
  },
  pocketValidationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6
  },
  pocketBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pIcon: {
    fontSize: 18,
    marginBottom: 2
  },
  pLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary
  }
});
