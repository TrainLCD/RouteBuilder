import { useEffect, useState } from 'react';
import { subscribe } from '../api/cache';

/**
 * Subscribes the calling component to global cache mutations so it re-renders
 * once previously-missing station/line data has arrived. Returns a monotonic
 * revision number that callers can ignore; observing the hook is the contract.
 */
export function useDataStore(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => subscribe(() => setRev((n) => n + 1)), []);
  return rev;
}
