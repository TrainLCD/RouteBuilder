import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type Tweaks = {
  theme: 'light' | 'dark';
  lang: 'ja' | 'en';
  density: 'compact' | 'comfortable';
};

const DEFAULT_TWEAKS: Tweaks = {
  theme: 'light',
  lang: 'ja',
  density: 'comfortable',
};

export function useTweaks() {
  const [tweaks, setTweaks] = useLocalStorage<Tweaks>('route-builder/tweaks', DEFAULT_TWEAKS);
  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
      setTweaks((prev) => ({ ...prev, [key]: value }));
    },
    [setTweaks],
  );
  return { tweaks, setTweak };
}
