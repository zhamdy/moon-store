import * as React from 'react';
import { Modal, ModalContent, useDisclosure } from '@heroui/react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

interface AlertDialogContextValue {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ open, defaultOpen, onOpenChange, children }) => {
  const disclosure = useDisclosure({
    isOpen: open,
    defaultOpen,
    onOpenChange,
  });

  const contextValue = React.useMemo<AlertDialogContextValue>(
    () => ({
      isOpen: open !== undefined ? open : disclosure.isOpen,
      onOpenChange: onOpenChange || disclosure.onOpenChange,
      onClose: disclosure.onClose,
    }),
    [open, onOpenChange, disclosure.isOpen, disclosure.onOpenChange, disclosure.onClose]
  );

  return <AlertDialogContext.Provider value={contextValue}>{children}</AlertDialogContext.Provider>;
};

const AlertDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        ctx?.onOpenChange(true);
      }}
      {...props}
    />
  );
});
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

const AlertDialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
const AlertDialogOverlay: React.FC<{ className?: string }> = () => null;

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, _ref) => {
    const ctx = React.useContext(AlertDialogContext);

    return (
      <Modal
        isOpen={ctx?.isOpen}
        onOpenChange={ctx?.onOpenChange}
        onClose={ctx?.onClose}
        isDismissable={false}
        hideCloseButton={true}
        placement="center"
        classNames={{
          backdrop: 'bg-black/80 backdrop-blur-sm z-50',
          wrapper: 'z-50',
          base: cn(
            'border border-card-border bg-card text-foreground shadow-lg rounded-md font-sans max-w-lg p-6 grid gap-4',
            className
          ),
        }}
        {...props}
      >
        <ModalContent>{() => <>{children}</>}</ModalContent>
      </Modal>
    );
  }
);
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-2 text-center sm:text-start', className)}
      {...props}
    />
  )
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold font-display tracking-wider text-foreground', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const ctx = React.useContext(AlertDialogContext);
  return (
    <Button
      ref={ref}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        ctx?.onClose();
      }}
      {...props}
    />
  );
});
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const ctx = React.useContext(AlertDialogContext);
  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn('mt-2 sm:mt-0', className)}
      onClick={(e) => {
        onClick?.(e);
        ctx?.onClose();
      }}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
