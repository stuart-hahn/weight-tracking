import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getUser } from '../api/client';
import {
  calendarTodayISO,
  getDeviceTimeZone,
  getEffectiveTimeZone,
  getStoredTimeZonePreference,
  isValidIanaTimeZone,
  setStoredTimeZonePreference,
  TIME_ZONE_STORAGE_KEY,
} from '../utils/calendarDate';

export type TimeZonePreference = 'auto' | string;

type Ctx = {
  preference: TimeZonePreference;
  effectiveTimeZone: string;
  /** Today YYYY-MM-DD in effective zone */
  todayISO: string;
  setPreference: (value: TimeZonePreference) => void;
};

const TimeZoneContext = createContext<Ctx | null>(null);

function readInitialPreference(): TimeZonePreference {
  const stored = getStoredTimeZonePreference();
  if (stored === null) return 'auto';
  return stored;
}

export function TimeZonePreferenceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<TimeZonePreference>(readInitialPreference);

  const effectiveTimeZone = useMemo(() => getEffectiveTimeZone(preference), [preference]);

  const todayISO = useMemo(() => calendarTodayISO(effectiveTimeZone), [effectiveTimeZone]);

  const setPreference = useCallback((value: TimeZonePreference) => {
    const next = value === 'auto' ? 'auto' : isValidIanaTimeZone(value) ? value : 'auto';
    setPreferenceState(next);
    setStoredTimeZonePreference(next);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TIME_ZONE_STORAGE_KEY) return;
      setPreferenceState(readInitialPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUser(userId);
        if (cancelled) return;
        if (getStoredTimeZonePreference() === null && profile.timezone != null && isValidIanaTimeZone(profile.timezone)) {
          setPreferenceState(profile.timezone);
          setStoredTimeZonePreference(profile.timezone);
        }
      } catch {
        /* offline / 401 — keep local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo(
    () => ({
      preference,
      effectiveTimeZone,
      todayISO,
      setPreference,
    }),
    [preference, effectiveTimeZone, todayISO, setPreference]
  );

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): Ctx {
  const ctx = useContext(TimeZoneContext);
  if (!ctx) {
    const device = getDeviceTimeZone();
    return {
      preference: 'auto',
      effectiveTimeZone: device,
      todayISO: calendarTodayISO(device),
      setPreference: () => {},
    };
  }
  return ctx;
}
