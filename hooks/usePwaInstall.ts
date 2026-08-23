import { useEffect, useState } from 'react';

export type InstallPlatform = 'android' | 'ios' | 'desktop' | 'standalone';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'MIDI_AI_INSTALL_DISMISSED';

export function getInstallPlatform(): InstallPlatform {
  if (typeof window === 'undefined') return 'desktop';

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'standalone';

  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';

  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return 'android';

  return 'desktop';
}

export function usePwaInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPlatform(getInstallPlatform());
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPlatform('standalone');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canInstall = platform !== 'standalone' && (platform === 'ios' || !!deferredPrompt || platform === 'android' || platform === 'desktop');

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return { platform, canInstall, deferredPrompt, dismissed, install, dismiss };
}
