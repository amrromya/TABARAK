import { useEffect, useState } from "react";

export interface ThemePreset {
  id: string;
  name: string;
  nameEn: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  preview: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "emerald", name: "زمردي", nameEn: "Emerald", primary: "#0f8a5f", primaryDark: "#0b6e4b", primaryLight: "#e6f4ee", preview: "linear-gradient(135deg, #0f8a5f, #0b6e4b)" },
  { id: "blue", name: "أزرق", nameEn: "Blue", primary: "#2563eb", primaryDark: "#1d4ed8", primaryLight: "#eff6ff", preview: "linear-gradient(135deg, #2563eb, #1d4ed8)" },
  { id: "purple", name: "بنفسجي", nameEn: "Purple", primary: "#7c3aed", primaryDark: "#6d28d9", primaryLight: "#f5f3ff", preview: "linear-gradient(135deg, #7c3aed, #6d28d9)" },
  { id: "rose", name: "وردي", nameEn: "Rose", primary: "#e11d48", primaryDark: "#be123c", primaryLight: "#fff1f2", preview: "linear-gradient(135deg, #e11d48, #be123c)" },
  { id: "orange", name: "برتقالي", nameEn: "Orange", primary: "#ea580c", primaryDark: "#c2410c", primaryLight: "#fff7ed", preview: "linear-gradient(135deg, #ea580c, #c2410c)" },
  { id: "teal", name: "أزرق مخضر", nameEn: "Teal", primary: "#0d9488", primaryDark: "#0f766e", primaryLight: "#f0fdfa", preview: "linear-gradient(135deg, #0d9488, #0f766e)" },
  { id: "indigo", name: "نيلي", nameEn: "Indigo", primary: "#4f46e5", primaryDark: "#4338ca", primaryLight: "#eef2ff", preview: "linear-gradient(135deg, #4f46e5, #4338ca)" },
  { id: "pink", name: "وردي فاتح", nameEn: "Pink", primary: "#db2777", primaryDark: "#be185d", primaryLight: "#fdf2f8", preview: "linear-gradient(135deg, #db2777, #be185d)" },
  { id: "amber", name: "كهرماني", nameEn: "Amber", primary: "#d97706", primaryDark: "#b45309", primaryLight: "#fffbeb", preview: "linear-gradient(135deg, #d97706, #b45309)" },
  { id: "cyan", name: "سماوي", nameEn: "Cyan", primary: "#0891b2", primaryDark: "#0e7490", primaryLight: "#ecfeff", preview: "linear-gradient(135deg, #0891b2, #0e7490)" },
];

const THEME_COLOR_KEY = "tabarak_color_theme";
const CUSTOM_COLOR_KEY = "tabarak_custom_color";

function getSavedThemeId(): string {
  return localStorage.getItem(THEME_COLOR_KEY) || "emerald";
}

function getSavedCustomColor(): string | null {
  return localStorage.getItem(CUSTOM_COLOR_KEY);
}

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

function hexToRgb(hex: string): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function useColorTheme() {
  const [themeId, setThemeId] = useState<string>(getSavedThemeId);
  const [customColor, setCustomColor] = useState<string>(() => getSavedCustomColor() || "#0f8a5f");

  const currentPreset = THEME_PRESETS.find((p) => p.id === themeId);
  const isCustom = themeId === "custom";

  const primary = isCustom ? customColor : (currentPreset?.primary || "#0f8a5f");
  const primaryDark = isCustom ? darkenHex(customColor, 22) : (currentPreset?.primaryDark || "#0b6e4b");
  const primaryLight = isCustom ? lightenHex(customColor, 200) : (currentPreset?.primaryLight || "#e6f4ee");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-dark", primaryDark);
    root.style.setProperty("--primary-light", primaryLight);
    root.style.setProperty("--primary-rgb", hexToRgb(primary));
    localStorage.setItem(THEME_COLOR_KEY, themeId);
    localStorage.setItem(CUSTOM_COLOR_KEY, customColor);
  }, [themeId, customColor, primary, primaryDark, primaryLight]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-dark", primaryDark);
    root.style.setProperty("--primary-light", primaryLight);
    root.style.setProperty("--primary-rgb", hexToRgb(primary));
  }, []);

  const selectPreset = (id: string) => {
    setThemeId(id);
  };

  const setCustom = (color: string) => {
    setThemeId("custom");
    setCustomColor(color);
  };

  const resetTheme = () => {
    setThemeId("emerald");
    setCustomColor("#0f8a5f");
  };

  return { themeId, customColor, selectPreset, setCustom, resetTheme, isCustom };
}
