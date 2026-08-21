import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { useTranslation } from '../../../shared/i18n/index';

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
    <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-data font-medium bg-muted/40 border border-border rounded-md text-foreground shadow-xs">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">{t('pos.shortcutsTitle')}</h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('pos.shortcutsDesc')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4">
              <div className="grid gap-1">
                {shortcuts.map((s) => (
                  <div
                    key={s.labelKey}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
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
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
