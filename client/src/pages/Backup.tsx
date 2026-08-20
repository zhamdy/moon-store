import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Database, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';

/**
 * `GET exports/backup` streams the SQLite file itself, not a JSON envelope, so
 * it is the one call on this page the transport cannot carry — everything above
 * that seam deals in rows. It is fetched directly instead, reading the same env
 * var and bearer token the HTTP client does.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function downloadBackup(): Promise<Blob> {
  const { accessToken } = useAuthStore.getState();
  const response = await fetch(`${API_BASE_URL}/api/v1/exports/backup`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new Error(`Backup request failed (${response.status})`);
  return response.blob();
}

export default function BackupPage() {
  const { t } = useTranslation();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const backupMutation = useMutation({
    mutationFn: downloadBackup,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moon-backup-${new Date().toISOString().split('T')[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackup(new Date().toISOString());
      toast.success(t('backup.created'));
    },
    onError: () => toast.error('Backup failed'),
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('backup.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <Card className="border-border">
          <CardContent className="p-6 text-center space-y-4">
            <Database className="h-16 w-16 text-gold/40 mx-auto" />
            <h2 className="text-lg font-display">{t('backup.title')}</h2>
            {lastBackup && (
              <p className="text-sm text-muted flex items-center justify-center gap-2">
                <Clock className="h-3.5 w-3.5" /> {t('backup.lastBackup')}:{' '}
                {new Date(lastBackup).toLocaleString()}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending}
                className="gap-2"
              >
                <Download className="h-4 w-4" /> {t('backup.backupNow')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
