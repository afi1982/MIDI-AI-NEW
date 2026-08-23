export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch((error) => {
      console.warn('[PWA] Service worker registration failed', error);
    });
  });
}
