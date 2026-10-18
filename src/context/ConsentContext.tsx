import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsentCategories = {
  analytics: boolean;
  marketing: boolean;
};

export type ConsentState = ConsentCategories & {
  decided: boolean;
};

type StoredConsent = ConsentCategories & {
  version: number;
  decided: boolean;
  timestamp: string;
};

type ConsentContextType = {
  consent: ConsentState;
  bannerVisible: boolean;
  preferencesOpen: boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (prefs: ConsentCategories) => void;
  openPreferences: () => void;
  closePreferences: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "dk-consent";
const CURRENT_VERSION = 1;
const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).decided !== "boolean" ||
      typeof (parsed as Record<string, unknown>).analytics !== "boolean" ||
      typeof (parsed as Record<string, unknown>).marketing !== "boolean" ||
      typeof (parsed as Record<string, unknown>).version !== "number" ||
      typeof (parsed as Record<string, unknown>).timestamp !== "string"
    ) {
      return null;
    }
    return parsed as StoredConsent;
  } catch {
    return null;
  }
}

function isExpired(stored: StoredConsent): boolean {
  try {
    const ts = new Date(stored.timestamp).getTime();
    return isNaN(ts) || Date.now() - ts > EXPIRY_MS;
  } catch {
    return true;
  }
}

function writeStored(prefs: ConsentCategories & { decided: boolean }) {
  try {
    const value: StoredConsent = {
      ...prefs,
      version: CURRENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable — graceful degradation; consent is not persisted.
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

function deriveInitialState(): { consent: ConsentState; bannerVisible: boolean } {
  const stored = readStored();
  const undecided: ConsentState = { decided: false, analytics: false, marketing: false };

  if (!stored || !stored.decided) {
    return { consent: undecided, bannerVisible: true };
  }
  if (stored.version < CURRENT_VERSION || isExpired(stored)) {
    return { consent: undecided, bannerVisible: true };
  }
  return {
    consent: { decided: true, analytics: stored.analytics, marketing: stored.marketing },
    bannerVisible: false,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ConsentContext = createContext<ConsentContextType | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const init = deriveInitialState();
  const [consent, setConsent] = useState<ConsentState>(init.consent);
  const [bannerVisible, setBannerVisible] = useState<boolean>(init.bannerVisible);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const persist = useCallback((prefs: ConsentCategories & { decided: boolean }) => {
    writeStored(prefs);
    setConsent(prefs);
    setBannerVisible(false);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ decided: true, analytics: true, marketing: true });
    setPreferencesOpen(false);
  }, [persist]);

  const rejectOptional = useCallback(() => {
    persist({ decided: true, analytics: false, marketing: false });
    setPreferencesOpen(false);
  }, [persist]);

  const savePreferences = useCallback(
    (prefs: ConsentCategories) => {
      persist({ decided: true, ...prefs });
      setPreferencesOpen(false);
    },
    [persist],
  );

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  return (
    <ConsentContext.Provider
      value={{
        consent,
        bannerVisible,
        preferencesOpen,
        acceptAll,
        rejectOptional,
        savePreferences,
        openPreferences,
        closePreferences,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextType {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside ConsentProvider");
  return ctx;
}
