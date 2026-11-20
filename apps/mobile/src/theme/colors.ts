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
  bgDeep: '#060E1E',        // Bleu nuit profond (palette officielle Budgeo)
  bgSurface: '#0B1936',     // Surface marine
  bgCard: 'rgba(14, 28, 58, 0.88)', // Carte bleu nuit translucide
  bgCardHover: '#152952',
  bgInput: '#0F2144',       // Input bleu nuit

  accentEmerald: '#25509F', // Bleu Royal Officiel Budgeo (boutons et onglets actifs)
  accentEmeraldGlow: 'rgba(37, 80, 159, 0.35)',
  accentCyan: '#38BDF8',    // Cyan ciel
  accentCyanGlow: 'rgba(56, 189, 248, 0.25)',
  accentViolet: '#818CF8',  // Indigo doux
  accentAmber: '#C5A14D',   // Doré Officiel Budgeo (flèches et étoiles du logo)
  accentRose: '#F43F5E',

  pocketFood: '#25509F',    // Bleu Royal
  pocketTransport: '#38BDF8',// Cyan
  pocketPleasure: '#818CF8', // Indigo
  pocketCushion: '#C5A14D',  // Or Budgeo

  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  borderSubtle: 'rgba(37, 80, 159, 0.25)',
};

export const lightColors: ColorPalette = {
  bgDeep: '#F4F7FC',        // Blanc bleuté très doux
  bgSurface: '#FFFFFF',     // Blanc pur
  bgCard: '#FFFFFF',        // Cartes blanches avec ombre
  bgCardHover: '#EBF1FB',
  bgInput: '#EBF1FB',       // Fond d'input gris-bleu très doux

  accentEmerald: '#1E4DA1', // Bleu Royal soutenu
  accentEmeraldGlow: 'rgba(30, 77, 161, 0.2)',
  accentCyan: '#0284C7',
  accentCyanGlow: 'rgba(2, 132, 199, 0.15)',
  accentViolet: '#6366F1',
  accentAmber: '#C5A14D',   // Doré officiel Budgeo
  accentRose: '#E11D48',

  pocketFood: '#1E4DA1',
  pocketTransport: '#0284C7',
  pocketPleasure: '#6366F1',
  pocketCushion: '#C5A14D',

  textPrimary: '#072152',   // Bleu marine officiel du texte du logo Budgeo
  textSecondary: '#2A4374', // Bleu ardoise
  textMuted: '#5B729D',

  borderSubtle: '#D1DEF2',
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
