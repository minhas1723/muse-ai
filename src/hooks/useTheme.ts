import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type FontSize = "small" | "normal" | "large" | "xl";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");

  // Helper to apply theme to DOM
  const applyTheme = useCallback((currentTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme = currentTheme;
    if (currentTheme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
  }, []);

  // Helper to apply font size to DOM
  const applyFontSize = useCallback((size: FontSize) => {
    const root = window.document.documentElement;
    root.setAttribute("data-fontsize", size);
  }, []);

  // 1. Load initial value & Listen for storage changes
  useEffect(() => {
    // Initial load
    chrome.storage.local.get(["theme", "fontSize"], (result) => {
      if (result.theme) {
        setThemeState(result.theme as Theme);
        applyTheme(result.theme as Theme);
      } else {
        applyTheme("system"); // Default
      }
      
      if (result.fontSize) {
        setFontSizeState(result.fontSize as FontSize);
        applyFontSize(result.fontSize as FontSize);
      } else {
        applyFontSize("normal"); // Default
      }
    });

    // Listener for changes (e.g. from other tabs or components)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.theme) {
        const newTheme = changes.theme.newValue as Theme;
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
      if (changes.fontSize) {
        const newSize = changes.fontSize.newValue as FontSize;
        setFontSizeState(newSize);
        applyFontSize(newSize);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [applyTheme, applyFontSize]);

  // 2. Listen for System Preference changes (only matters if theme === 'system')
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme, applyTheme]);

  // Public setters
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme); 
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
  }, [applyTheme]);

  const setFontSize = useCallback((newSize: FontSize) => {
    setFontSizeState(newSize);
    applyFontSize(newSize);
    chrome.storage.local.set({ fontSize: newSize });
  }, [applyFontSize]);

  return { theme, setTheme, fontSize, setFontSize };
}
