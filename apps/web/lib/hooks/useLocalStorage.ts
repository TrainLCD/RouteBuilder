import { useEffect, useRef, useState } from 'react';

const hasWindow = typeof window !== 'undefined';

export function useLocalStorage<T>(
  key: string,
  initial: T,
  sanitize?: (raw: unknown) => T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!hasWindow) return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return sanitize ? sanitize(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  });

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!hasWindow) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore — quota or privacy mode
    }
  }, [key, value]);

  return [value, setValue];
}
