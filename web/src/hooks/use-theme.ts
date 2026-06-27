import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "fmh-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggle: () =>
      setThemeState((current) => {
        const resolved = current === "system" ? getSystemTheme() : current;
        return resolved === "dark" ? "light" : "dark";
      }),
  };
}

export function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const theme: Theme =
    stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  applyTheme(theme);
}
