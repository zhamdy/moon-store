import * as React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { cn } from '@/shared/lib/utils';

interface DialogContextValue {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, defaultOpen, onOpenChange, children }) => {
  const disclosure = useDisclosure({
    isOpen: open,
    defaultOpen,
    onOpenChange,
  });

  const contextValue = React.useMemo<DialogContextValue>(
    () => ({
      isOpen: open !== undefined ? open : disclosure.isOpen,
      onOpenChange: onOpenChange || disclosure.onOpenChange,
      onClose: disclosure.onClose,
    }),
    [open, onOpenChange, disclosure.isOpen, disclosure.onOpenChange, disclosure.onClose]
  );

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
};

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
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
DialogTrigger.displayName = 'DialogTrigger';

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        ctx?.onClose();
      }}
      {...props}
    />
  );
});
DialogClose.displayName = 'DialogClose';

const DialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
const DialogOverlay: React.FC<{ className?: string }> = () => null;

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  hideCloseButton?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size = 'lg', hideCloseButton = false, ...props }, _ref) => {
    const ctx = React.useContext(DialogContext);

    return (
      <Modal
        isOpen={ctx?.isOpen}
        onOpenChange={ctx?.onOpenChange}
        onClose={ctx?.onClose}
        size={size}
        hideCloseButton={hideCloseButton}
        placement="center"
        scrollBehavior="inside"
        classNames={{
          backdrop: 'bg-black/80 backdrop-blur-sm z-50',
          wrapper: 'z-50',
          base: cn(
            'border border-card-border bg-card text-foreground shadow-lg rounded-md font-sans max-w-lg p-6 grid gap-4',
            className
          ),
          closeButton: 'hover:bg-surface text-gold end-4 top-4 p-1.5',
        }}
        {...props}
      >
        <ModalContent>{() => <>{children}</>}</ModalContent>
      </Modal>
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 text-center sm:text-start', className)}
      {...props}
    />
  )
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-semibold leading-none tracking-wider font-display text-foreground',
        className
      )}
      {...props}
    />
  )
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
};
