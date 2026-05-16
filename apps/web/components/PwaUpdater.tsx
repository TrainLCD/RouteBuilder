'use client';

import { useEffect, useState } from 'react';

/** Periodic background check for new SW (30 min while the tab is open). */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Registers `/sw.js`, watches for new SW installs, and renders a toast
 * with an "Update" button when a new version is waiting to activate.
 * Clicking Update posts SKIP_WAITING to the waiting worker, which takes
 * control and triggers a `controllerchange` event — we then reload so
 * the new JS/CSS is what's running.
 */
export function PwaUpdater() {
  const [waitingSw, setWaitingSw] = useState<ServiceWorker | null>(null);

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

  const applyUpdate = () => {
    waitingSw.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className="pwa-update-toast" role="alert" aria-live="polite">
      <span>新しいバージョンが利用可能です</span>
      <button type="button" onClick={applyUpdate}>更新</button>
    </div>
  );
}
