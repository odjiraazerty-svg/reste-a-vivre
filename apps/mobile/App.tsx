import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CalibrationScreen } from './src/screens/CalibrationScreen';
import { AiAuditScreen } from './src/screens/AiAuditScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { StorageService, StoredUser } from './src/services/storage';
import { ApiService } from './src/services/api';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { colors } from './src/theme/colors';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 38) : 44;

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

function MainApp() {
  const { theme, colors: themeColors, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'DASH' | 'SETTINGS' | 'AUDIT' | 'HISTORY'>('DASH');
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Au démarrage : afficher systématiquement le formulaire d'authentification
    const initAuth = async () => {
      try {
        await ApiService.logout();
        setCurrentUser(null);
      } catch (e) {
        console.warn('Erreur initialisation auth:', e);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  const handleLogout = async () => {
    await StorageService.resetAllStorage();
    await ApiService.logout();
    setCurrentUser(null);
  };

  const handleThemeToggle = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    toggleTheme();
  };

  // Écran de chargement initial
  if (isInitializing) {
    return (
      <View style={[styles.rootContainer, styles.center, { backgroundColor: themeColors.bgDeep }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={themeColors.accentEmerald} />
      </View>
    );
  }

  // Si non authentifié, afficher le formulaire de connexion / création de compte
  if (!currentUser) {
    return (
      <View style={[styles.rootContainer, { backgroundColor: themeColors.bgDeep }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} translucent={false} backgroundColor={themeColors.bgDeep} />
        <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />
      </View>
    );
  }

  // Utilisateur connecté : affichage de l'application principale
  return (
    <View style={[styles.rootContainer, { backgroundColor: themeColors.bgDeep }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent={false} backgroundColor={themeColors.bgDeep} />

      {/* Barre supérieure utilisateur avec sélecteur de thème & bouton déconnexion */}
      <View style={[
        styles.userBar,
        {
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.45)' : '#FFFFFF',
          borderBottomColor: themeColors.borderSubtle
        }
      ]}>
        <View style={styles.userInfo}>
          <Text style={[styles.userEmail, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {currentUser.username ? `@${currentUser.username}` : currentUser.email}
          </Text>
          <Text style={styles.userBadge}>PROTÉGÉ 🛡️</Text>
        </View>

        {/* Sélecteur de Thème Rapide (Fond Blanc / Nuit) */}
        <TouchableOpacity
          style={[
            styles.themeToggleBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              borderColor: themeColors.borderSubtle
            }
          ]}
          onPress={handleThemeToggle}
          activeOpacity={0.7}
          accessibilityLabel="Changer de thème"
        >
          <Text style={styles.themeToggleIcon}>{isDark ? '☀️' : '🌙'}</Text>
          <Text style={[styles.themeToggleLabel, { color: themeColors.textPrimary }]}>
            {isDark ? 'Blanc' : 'Nuit'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Contenu de l'écran actif */}
      <View style={styles.content}>
        {activeTab === 'DASH' && <DashboardScreen currentUser={currentUser} />}
        {activeTab === 'SETTINGS' && <CalibrationScreen currentUser={currentUser} />}
        {activeTab === 'AUDIT' && <AiAuditScreen currentUser={currentUser} />}
        {activeTab === 'HISTORY' && <HistoryScreen currentUser={currentUser} />}
      </View>

      {/* Barre de Navigation Inférieure (Dock Tabs) */}
      <View style={[
        styles.dock,
        {
          backgroundColor: isDark ? 'rgba(14, 19, 31, 0.98)' : '#FFFFFF',
          borderTopColor: themeColors.borderSubtle
        }
      ]}>
        <TouchableOpacity
          style={[styles.dockBtn, activeTab === 'DASH' && styles.dockBtnActive]}
          onPress={() => setActiveTab('DASH')}
        >
          <Text style={styles.dockIcon}>📊</Text>
          <Text style={[
            styles.dockLabel,
            { color: activeTab === 'DASH' ? themeColors.accentEmerald : themeColors.textMuted },
            activeTab === 'DASH' && styles.dockLabelActive
          ]}>RAV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockBtn, activeTab === 'SETTINGS' && styles.dockBtnActive]}
          onPress={() => setActiveTab('SETTINGS')}
        >
          <Text style={styles.dockIcon}>🎚️</Text>
          <Text style={[
            styles.dockLabel,
            { color: activeTab === 'SETTINGS' ? themeColors.accentEmerald : themeColors.textMuted },
            activeTab === 'SETTINGS' && styles.dockLabelActive
          ]}>Flux</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockBtn, activeTab === 'AUDIT' && styles.dockBtnActive]}
          onPress={() => setActiveTab('AUDIT')}
        >
          <Text style={styles.dockIcon}>💡</Text>
          <Text style={[
            styles.dockLabel,
            { color: activeTab === 'AUDIT' ? themeColors.accentEmerald : themeColors.textMuted },
            activeTab === 'AUDIT' && styles.dockLabelActive
          ]}>Audit IA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockBtn, activeTab === 'HISTORY' && styles.dockBtnActive]}
          onPress={() => setActiveTab('HISTORY')}
        >
          <Text style={styles.dockIcon}>📜</Text>
          <Text style={[
            styles.dockLabel,
            { color: activeTab === 'HISTORY' ? themeColors.accentEmerald : themeColors.textMuted },
            activeTab === 'HISTORY' && styles.dockLabelActive
          ]}>Activité</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    paddingTop: STATUSBAR_HEIGHT
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1
  },
  userBadge: {
    color: colors.accentEmerald,
    fontSize: 9.5,
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)'
  },
  logoutText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700'
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8
  },
  themeToggleIcon: {
    fontSize: 13
  },
  themeToggleLabel: {
    fontSize: 11,
    fontWeight: '700'
  },
  content: {
    flex: 1
  },
  dock: {
    height: Platform.OS === 'android' ? 88 : 70,
    backgroundColor: 'rgba(14, 19, 31, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 26 : 10
  },
  dockBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70
  },
  dockBtnActive: {},
  dockIcon: {
    fontSize: 20,
    marginBottom: 2
  },
  dockLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted
  },
  dockLabelActive: {
    color: colors.accentEmerald,
    fontWeight: '700'
  }
});
