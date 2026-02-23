import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show after 30 seconds on first visit
    const timer = setTimeout(() => {
      if (deferredPrompt) {
        setShowPrompt(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 end-6 z-50 animate-fade-in">
      <div className="bg-card border border-gold/30 rounded-md p-4 shadow-glow-strong max-w-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-gold/20 flex items-center justify-center shrink-0">
            <Download className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground font-display tracking-wider">
              {t('pwa.installApp')}
            </p>
            <p className="text-xs text-muted mt-1">
              {t('pwa.installDesc')}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleInstall}>
                {t('common.install')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPrompt(false)}>
                {t('common.later')}
              </Button>
            </div>
          </div>
          <button onClick={() => setShowPrompt(false)} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
