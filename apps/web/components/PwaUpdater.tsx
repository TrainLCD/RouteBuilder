'use client';

import { useEffect, useRef, useState } from 'react';

/** Periodic background check for new SW (30 min while the tab is open). */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Generous fallback for when `controllerchange` never fires. The cost of
 *  reloading too early is bad: it can pick up the old SW as controller
 *  before activation completes and re-trigger the update prompt in a loop.
 *  10s is well beyond a normal SW activation. */
const RELOAD_FALLBACK_MS = 10_000;

/**
 * Registers `/sw.js`, watches for new SW installs, and renders a toast
 * with an "Update" button when a new version is waiting to activate.
 * Clicking Update posts SKIP_WAITING to the waiting worker, which takes
 * control and triggers a `controllerchange` event — we then reload so
 * the new JS/CSS is what's running.
 */
export function PwaUpdater() {
  const [waitingSw, setWaitingSw] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  /**
   * Gates the `controllerchange` reload to user-initiated updates only.
   * On the very first SW install (no previous controller), Serwist's
   * `clientsClaim: true` also fires `controllerchange` — without this
   * gate we would reload on that initial install too, which is jarring
   * and unnecessary.
   */
  const updateRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;

    const watchInstalling = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          // A new worker is installed and the page is already controlled by
          // an old worker → there's a real update waiting.
          setWaitingSw(worker);
        }
      });
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingSw(reg.waiting);
        }
        if (reg.installing) watchInstalling(reg.installing);
        reg.addEventListener('updatefound', () => {
          if (reg.installing) watchInstalling(reg.installing);
        });
      } catch (err) {
        console.warn('[PWA] service worker registration failed:', err);
      }
    };
    void register();

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      if (!updateRequestedRef.current) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkForUpdate = () => {
      if (registration && document.visibilityState === 'visible') {
        void registration.update();
      }
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!waitingSw) return null;

  const applyUpdate = async () => {
    if (applying) return;
    setApplying(true);
    updateRequestedRef.current = true;

    // Re-query the registration so we always post to the currently-waiting
    // worker, in case the cached `waitingSw` ref went stale between
    // statechange firing and the click.
    let target: ServiceWorker | null = waitingSw;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) target = reg.waiting;
    } catch {
      // ignore — fall back to the cached reference
    }
    target?.postMessage({ type: 'SKIP_WAITING' });

    // Safety net: if `controllerchange` doesn't fire after activation
    // (browser quirk / non-controlled edge case), reload anyway. The
    // window is generous so we don't reload during activation and risk
    // attaching to the old SW.
    window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
  };

  return (
    <div className="pwa-update-toast" role="alert" aria-live="polite">
      <span>新しいバージョンが利用可能です</span>
      <button
        type="button"
        onClick={() => void applyUpdate()}
        disabled={applying}
        aria-busy={applying}
      >
        {applying ? '更新中…' : '更新'}
      </button>
    </div>
  );
}
