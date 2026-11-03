import React, { createContext, useContext, useState, useEffect } from 'react';
import { ColorPalette, darkColors, lightColors, applyThemeMode } from './colors';
import { StorageService } from '../services/storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  theme: ThemeMode;
  colors: ColorPalette;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    StorageService.getThemeMode().then((saved) => {
      if (saved) {
        setThemeState(saved);
        applyThemeMode(saved);
      }
    });
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeMode(mode);
    StorageService.setThemeMode(mode);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const activeColors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: activeColors,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

