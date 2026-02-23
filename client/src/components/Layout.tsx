import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useOffline } from '../hooks/useOffline';
import { useTranslation } from '../i18n';
import { WifiOff } from 'lucide-react';

export default function Layout(): React.JSX.Element {
  const { isOnline, queueLength } = useOffline();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ms-64 min-h-screen pb-20 lg:pb-0">
        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-gold-dark/20 border-b border-gold-dark text-gold px-4 py-2 text-sm flex items-center gap-2 font-data">
            <WifiOff className="h-4 w-4" />
            {t('offline.offlineBanner')}{queueLength > 0 && ` ${t('offline.queuedForSync', { count: queueLength })}`}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
