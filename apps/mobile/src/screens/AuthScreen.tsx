import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ApiService } from '../services/api';
import { StoredUser } from '../services/storage';
import { useTheme } from '../theme/ThemeContext';
import { colors } from '../theme/colors';

interface AuthScreenProps {
  onAuthSuccess: (user: StoredUser) => void;
}

interface InitialPocketConfig {
  key: string;
  name: string;
  icon: string;
  colorHex: string;
  targetPercentage: number;
  displayOrder: number;
  isSystemDefault: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Les 4 poches initiales proposées avec taux modifiables
  const [initialPockets, setInitialPockets] = useState<InitialPocketConfig[]>([
    { key: 'food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1, isSystemDefault: false },
    { key: 'transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2, isSystemDefault: false },
    { key: 'pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3, isSystemDefault: false },
    { key: 'cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isSystemDefault: true }
  ]);

  const totalPercentage = Math.round(initialPockets.reduce((sum, p) => sum + p.targetPercentage, 0) * 100);

  const handleAdjustPocketPct = (key: string, delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }

    setInitialPockets(prev =>
      prev.map(p => {
        if (p.key === key) {
          const next = Math.max(0.05, Math.min(0.80, Number((p.targetPercentage + delta).toFixed(2))));
          return { ...p, targetPercentage: next };
        }
        return p;
      })
    );
  };

  const handleAutoBalance = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) { }

    const nonCushionTotal = initialPockets
      .filter(p => p.key !== 'cushion')
      .reduce((sum, p) => sum + p.targetPercentage, 0);

    const remainder = Math.max(0.05, Number((1.0 - nonCushionTotal).toFixed(2)));

    setInitialPockets(prev =>
      prev.map(p => (p.key === 'cushion' ? { ...p, targetPercentage: remainder } : p))
    );
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Veuillez saisir votre pseudo (ou email) et votre mot de passe.');
      return;
    }

    if (!isLoginMode && totalPercentage !== 100) {
      setErrorMessage(`Le total alloué à vos 4 poches fait ${totalPercentage}%. Ajustez pour atteindre 100% (ou utilisez le bouton "Équilibrer").`);
      return;
    }

    try {
      setLoading(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) { }

      let result;
      if (isLoginMode) {
        result = await ApiService.login(identifier.trim(), password);
      } else {
        result = await ApiService.register(identifier.trim(), password, currency, initialPockets);
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) { }

      onAuthSuccess(result.user);
    } catch (err: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (e) { }
      setErrorMessage(err.message || 'Une erreur est survenue lors de l\'authentification.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (usePseudo: boolean = true) => {
    if (usePseudo) {
      setIdentifier('alexandre');
    } else {
      setIdentifier('alexandre.dupont@entreprise.fr');
    }
    setPassword('password123');
    setIsLoginMode(true);
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.bgDeep }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* En-tête de marque */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>
          <Text style={[styles.appName, { color: themeColors.textPrimary }]}>RAV</Text>
          <Text style={[styles.appSubtitle, { color: themeColors.textSecondary }]}>Reste À Vivre Prédictif</Text>
          <Text style={styles.securityTag}>100% Autonome • Zero Open-Banking • PostgreSQL</Text>
        </View>

        {/* Carte de Formulaire */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.borderSubtle }]}>
          {/* Onglets Connexion / Inscription */}
          <View style={[styles.tabsContainer, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F1F5F9' }]}>
            <TouchableOpacity
              style={[styles.tab, isLoginMode && styles.tabActive]}
              onPress={() => {
                setIsLoginMode(true);
                setErrorMessage(null);
              }}
            >
              <Text style={[styles.tabText, { color: themeColors.textMuted }, isLoginMode && styles.tabTextActive]}>Connexion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, !isLoginMode && styles.tabActive]}
              onPress={() => {
                setIsLoginMode(false);
                setErrorMessage(null);
              }}
            >
              <Text style={[styles.tabText, { color: themeColors.textMuted }, !isLoginMode && styles.tabTextActive]}>Créer un compte</Text>
            </TouchableOpacity>
          </View>

          {/* Message d'erreur */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {/* Champ Pseudo ou Email */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>
                {isLoginMode ? 'Pseudo ou Adresse Email' : 'Votre Pseudo (ou Email)'}
              </Text>
              <Text style={styles.badgeHint}>Sans email requis</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={isLoginMode ? "Ex: alexandre ou vous@email.com" : "Ex: mamadou, alexandre..."}
              placeholderTextColor={colors.textMuted}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Champ Mot de Passe */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mot de Passe</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Section spécifique à la création de compte */}
          {!isLoginMode && (
            <>
              {/* Devise */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Devise Principale</Text>
                <View style={styles.currencyRow}>
                  {['FCFA', 'EUR', 'USD', 'CHF'].map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[styles.currencyBtn, currency === curr && styles.currencyBtnActive]}
                      onPress={() => setCurrency(curr)}
                    >
                      <Text
                        style={[
                          styles.currencyBtnText,
                          currency === curr && styles.currencyBtnTextActive
                        ]}
                      >
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Vos 4 Poches Initiales Proposées */}
              <View style={styles.pocketsSetupSection}>
                <View style={styles.pocketsSetupHeader}>
                  <Text style={styles.fieldLabel}>Vos 4 Poches Initiales</Text>
                  <Text style={[
                    styles.totalPctBadge,
                    totalPercentage === 100 ? styles.totalPctValid : styles.totalPctWarning
                  ]}>
                    Total : {totalPercentage}% {totalPercentage === 100 ? '✅' : '⚠️'}
                  </Text>
                </View>
                <Text style={styles.pocketsSetupDesc}>
                  Ajustez les pourcentages selon votre mode de vie (modifiable à tout moment) :
                </Text>

                <View style={styles.pocketsList}>
                  {initialPockets.map(p => (
                    <View key={p.key} style={styles.pocketRow}>
                      <View style={styles.pocketRowLeft}>
                        <Text style={styles.pocketIcon}>{p.icon}</Text>
                        <View>
                          <Text style={styles.pocketName}>{p.name}</Text>
                          <Text style={styles.pocketRole}>
                            {p.key === 'cushion' ? 'Amortisseur anti-découvert' : 'Dépenses courantes'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pocketControls}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => handleAdjustPocketPct(p.key, -0.05)}
                        >
                          <Text style={styles.stepBtnText}>-5%</Text>
                        </TouchableOpacity>

                        <Text style={styles.pctValueText}>
                          {Math.round(p.targetPercentage * 100)}%
                        </Text>

                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => handleAdjustPocketPct(p.key, 0.05)}
                        >
                          <Text style={styles.stepBtnText}>+5%</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {totalPercentage !== 100 && (
                  <TouchableOpacity style={styles.btnAutoBalance} onPress={handleAutoBalance}>
                    <Text style={styles.btnAutoBalanceText}>
                      ⚖️ Équilibrer automatiquement à 100%
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Bouton de Soumission */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isLoginMode ? 'Se Connecter ⚡' : 'Créer mon Espace RAV ✨'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Raccourcis Démo (Pseudo & Email) */}
          <View style={styles.demoRow}>
            <TouchableOpacity style={styles.demoChip} onPress={() => handleFillDemo(true)}>
              <Text style={styles.demoChipText}>💡 Démo Pseudo ("alexandre")</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoChip} onPress={() => handleFillDemo(false)}>
              <Text style={styles.demoChipText}>📧 Démo Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mention de confidentialité */}
        <Text style={styles.footerNote}>
          Totalement confidentiel : vous n'avez pas besoin de partager votre identité bancaire ni votre email personnel.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.accentEmerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  logoIcon: {
    fontSize: 28
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1.5
  },
  appSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentEmerald,
    marginTop: 2
  },
  securityTag: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 24,
    padding: 18
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10
  },
  tabActive: {
    backgroundColor: colors.accentEmerald
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMuted
  },
  tabTextActive: {
    color: '#07090E',
    fontWeight: '800'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16
  },
  fieldGroup: {
    marginBottom: 14
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  badgeHint: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 6
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  currencyBtnActive: {
    borderColor: colors.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  currencyBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted
  },
  currencyBtnTextActive: {
    color: colors.accentEmerald,
    fontWeight: '800'
  },
  pocketsSetupSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  pocketsSetupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  totalPctBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  totalPctValid: {
    color: colors.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.12)'
  },
  totalPctWarning: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)'
  },
  pocketsSetupDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 10
  },
  pocketsList: {
    gap: 8
  },
  pocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  pocketRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  pocketIcon: {
    fontSize: 18
  },
  pocketName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  pocketRole: {
    fontSize: 9.5,
    color: colors.textMuted
  },
  pocketControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  stepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  stepBtnText: {
    color: colors.textPrimary,
    fontSize: 10.5,
    fontWeight: '700'
  },
  pctValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentEmerald,
    minWidth: 34,
    textAlign: 'center'
  },
  btnAutoBalance: {
    marginTop: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnAutoBalanceText: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '700'
  },
  submitBtn: {
    backgroundColor: colors.accentEmerald,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: colors.accentEmerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  submitBtnText: {
    color: '#07090E',
    fontSize: 14.5,
    fontWeight: '800'
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center'
  },
  demoChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  demoChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 16,
    lineHeight: 15
  }
});
