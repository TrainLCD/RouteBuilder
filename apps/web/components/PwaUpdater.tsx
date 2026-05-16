'use client';

import { useEffect, useState } from 'react';

/** Periodic background check for new SW (30 min while the tab is open). */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Fallback hard-reload delay if `controllerchange` doesn't fire after
 *  SKIP_WAITING (some browsers + edge cases). */
const RELOAD_FALLBACK_MS = 1500;

/**
 * Registers `/sw.js`, watches for new SW installs, and renders a toast
 * with an "Update" button when a new version is waiting to activate.
 * Clicking Update posts SKIP_WAITING to the waiting worker, which takes
 * control and triggers a `controllerchange` event — we then reload so
 * the new JS/CSS is what's running. A safety-net timeout reloads even
 * if controllerchange never fires.
 */
export function PwaUpdater() {
  const [waitingSw, setWaitingSw] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);

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

    // The cached `waitingSw` can in rare cases be a stale reference (the
    // worker transitioned between when statechange fired and when the
    // user clicked). Re-query the registration so we always post to the
    // currently-waiting worker.
    let target: ServiceWorker | null = waitingSw;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) target = reg.waiting;
    } catch {
      // ignore — fall back to the cached reference
    }
    target?.postMessage({ type: 'SKIP_WAITING' });

    // controllerchange should fire and trigger a reload once the new SW
    // claims this client. If it doesn't (some browsers / non-controlled
    // edge cases) reload anyway — the new SW will be active on the next
    // load regardless.
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
