/**
 * PALETTES DESIGN FINTECH LUXE POUR REACT NATIVE
 * Support des modes NUIT (Dark) et FOND BLANC (Light)
 */

export interface ColorPalette {
  // Arrière-plans
  bgDeep: string;
  bgSurface: string;
  bgCard: string;
  bgCardHover: string;
  bgInput: string;

  // Accents Vifs
  accentEmerald: string;
  accentEmeraldGlow: string;
  accentCyan: string;
  accentCyanGlow: string;
  accentViolet: string;
  accentAmber: string;
  accentRose: string;

  // Poches
  pocketFood: string;
  pocketTransport: string;
  pocketPleasure: string;
  pocketCushion: string;

  // Textes
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Bordures
  borderSubtle: string;
}

export const darkColors: ColorPalette = {
  bgDeep: '#07090E',
  bgSurface: '#0E131F',
  bgCard: 'rgba(19, 26, 42, 0.85)',
  bgCardHover: '#1C263E',
  bgInput: '#141C2E',

  accentEmerald: '#10B981',
  accentEmeraldGlow: 'rgba(16, 185, 129, 0.25)',
  accentCyan: '#06B6D4',
  accentCyanGlow: 'rgba(6, 182, 212, 0.25)',
  accentViolet: '#8B5CF6',
  accentAmber: '#F59E0B',
  accentRose: '#F43F5E',

  pocketFood: '#10B981',
  pocketTransport: '#06B6D4',
  pocketPleasure: '#8B5CF6',
  pocketCushion: '#F59E0B',

  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  borderSubtle: 'rgba(255, 255, 255, 0.08)',
};

export const lightColors: ColorPalette = {
  bgDeep: '#F8FAFC',        // Slate 50 ultra-clair
  bgSurface: '#FFFFFF',     // Blanc pur
  bgCard: '#FFFFFF',        // Cartes blanches avec ombre
  bgCardHover: '#F1F5F9',
  bgInput: '#F1F5F9',       // Fond d'input gris très doux

  accentEmerald: '#059669', // Vert émeraude avec fort contraste WCAG
  accentEmeraldGlow: 'rgba(5, 150, 105, 0.15)',
  accentCyan: '#0891B2',
  accentCyanGlow: 'rgba(8, 145, 178, 0.15)',
  accentViolet: '#7C3AED',
  accentAmber: '#D97706',
  accentRose: '#E11D48',

  pocketFood: '#059669',
  pocketTransport: '#0891B2',
  pocketPleasure: '#7C3AED',
  pocketCushion: '#D97706',

  textPrimary: '#0F172A',   // Slate 900 noir doux
  textSecondary: '#475569', // Slate 600
  textMuted: '#64748B',     // Slate 500

  borderSubtle: 'rgba(15, 23, 42, 0.08)',
};

// Variable mutable par défaut pour compatibilité descendante
export let currentThemeMode: 'dark' | 'light' = 'dark';
export const colors: ColorPalette = { ...darkColors };

export const applyThemeMode = (mode: 'dark' | 'light'): ColorPalette => {
  currentThemeMode = mode;
  const target = mode === 'light' ? lightColors : darkColors;
  Object.assign(colors, target);
  return colors;
};
