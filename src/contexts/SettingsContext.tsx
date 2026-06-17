import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const API = "";

export interface AppSettings {
  notify_sound: boolean;
  notify_desktop: boolean;
  notify_ai_indicator: boolean;
  notify_quiet_enabled: boolean;
  notify_quiet_start: string;
  notify_quiet_end: string;
  privacy_msg_encrypt: boolean;
  privacy_auto_delete: number;
  privacy_read_receipt: boolean;
  privacy_show_online: boolean;
  general_language: string;
  general_theme: string;
  general_font_size: string;
  features: Record<string, boolean>;
}

const defaultSettings: AppSettings = {
  notify_sound: true,
  notify_desktop: true,
  notify_ai_indicator: true,
  notify_quiet_enabled: false,
  notify_quiet_start: "22:00",
  notify_quiet_end: "08:00",
  privacy_msg_encrypt: false,
  privacy_auto_delete: 0,
  privacy_read_receipt: true,
  privacy_show_online: true,
  general_language: "zh-CN",
  general_theme: "auto",
  general_font_size: "normal",
  features: {},
};

interface SettingsContextType {
  settings: AppSettings;
  loaded: boolean;
  lang: "zh-CN" | "en";
  resolvedTheme: "dark" | "light";
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleFeature: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loaded: false,
  lang: "zh-CN",
  resolvedTheme: "light",
  updateSettings: () => {},
  toggleFeature: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const cached = localStorage.getItem("webchat_settings");
      if (cached) return { ...defaultSettings, ...JSON.parse(cached) };
    } catch {}
    return defaultSettings;
  });
  const [loaded, setLoaded] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    try {
      const cached = localStorage.getItem("webchat_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        const theme = parsed.general_theme || "auto";
        if (theme === "dark") return "dark";
        if (theme === "light") return "light";
      }
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Load from server on mount
  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === "object") setSettings(prev => ({ ...prev, ...d }));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Persist to localStorage whenever settings change
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("webchat_settings", JSON.stringify(settings)); } catch {}
  }, [loaded, settings]);

  // Apply theme to document and update resolvedTheme
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    const theme = settings.general_theme;
    let resolved: "dark" | "light" = "light";
    if (theme === "dark") {
      resolved = "dark";
    } else if (theme === "light") {
      resolved = "light";
    } else {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", resolved);
    setResolvedTheme(resolved);
    // Font size
    const sizeMap: Record<string, string> = { small: "13px", normal: "14px", large: "16px" };
    root.style.setProperty("--font-size-base", sizeMap[settings.general_font_size] || "14px");
  }, [loaded, settings.general_theme, settings.general_font_size]);

  // Listen for system theme changes when set to auto
  useEffect(() => {
    if (settings.general_theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", resolved);
      setResolvedTheme(resolved);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.general_theme]);

  const lang = (settings.general_language === "en" ? "en" : "zh-CN") as "zh-CN" | "en";

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      fetch(`${API}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, []);

  const toggleFeature = useCallback((id: string) => {
    setSettings(prev => {
      const features = { ...(prev.features || {}) };
      features[id] = features[id] === false ? true : false;
      const next = { ...prev, features };
      fetch(`${API}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
      fetch(`${API}/api/features`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [id]: features[id] }) }).catch(() => {});
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loaded, lang, resolvedTheme, updateSettings, toggleFeature }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
