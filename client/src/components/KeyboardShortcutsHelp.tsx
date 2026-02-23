import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useTranslation } from '../i18n';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string[];
  labelKey: string;
}

const shortcuts: ShortcutEntry[] = [
  { keys: ['F1'], labelKey: 'pos.shortcutSearch' },
  { keys: ['F2'], labelKey: 'pos.shortcutScan' },
  { keys: ['F3'], labelKey: 'pos.shortcutCheckout' },
  { keys: ['F4'], labelKey: 'pos.shortcutClearCart' },
  { keys: ['F5'], labelKey: 'pos.shortcutHoldCart' },
  { keys: ['+'], labelKey: 'pos.shortcutLastItemUp' },
  { keys: ['-'], labelKey: 'pos.shortcutLastItemDown' },
  { keys: ['Del'], labelKey: 'pos.shortcutRemoveLast' },
  { keys: ['Esc'], labelKey: 'pos.shortcutClose' },
  { keys: ['?'], labelKey: 'pos.shortcutHelp' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-data font-medium bg-surface border border-border rounded text-foreground">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pos.shortcutsTitle')}</DialogTitle>
          <DialogDescription>{t('pos.shortcutsDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 mt-2">
          {shortcuts.map((s) => (
            <div
              key={s.labelKey}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-surface transition-colors"
            >
              <span className="text-sm text-foreground">{t(s.labelKey)}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
