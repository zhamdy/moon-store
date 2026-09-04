import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Database, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, CardBody } from '@heroui/react';
import { useTranslation } from '../../../shared/i18n/index';
import { useTransport } from '../../../shared/lib/transport/index';
import { PageHeader } from '../../../shared';

export default function BackupPage() {
  const { t } = useTranslation();
  const transport = useTransport();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const backupMutation = useMutation({
    mutationFn: () =>
      transport
        .request<Blob>({ method: 'GET', path: 'exports/backup', responseType: 'blob' })
        .then((r) => r.data),
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
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('backup.title')} />

      <div className="max-w-md mx-auto pt-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto text-muted-foreground">
              <Database className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('backup.title')}</h2>
            {lastBackup && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {t('backup.lastBackup')}:{' '}
                {new Date(lastBackup).toLocaleString()}
              </p>
            )}
            <div className="pt-2">
              <Button
                color="primary"
                onClick={() => backupMutation.mutate()}
                isLoading={backupMutation.isPending}
                startContent={!backupMutation.isPending && <Download className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                {t('backup.backupNow')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
