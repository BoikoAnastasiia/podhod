import { createContext, useContext } from "react";

/**
 * "system" means no override: the data-theme attribute is absent and the
 * prefers-color-scheme media queries in theme.css decide. An explicit
 * choice writes data-theme onto <html>, which the same stylesheet gates on.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "podhod.theme";

export type ThemeContextValue = {
  theme: ThemeChoice;
  setTheme: (next: ThemeChoice) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme used outside ThemeContext");
  return ctx;
}
