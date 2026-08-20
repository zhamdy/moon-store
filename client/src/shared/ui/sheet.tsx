import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  useDisclosure,
} from '@heroui/react';
import { cn } from '@/shared/lib/utils';

interface SheetContextValue {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Sheet: React.FC<SheetProps> = ({ open, defaultOpen, onOpenChange, children }) => {
  const disclosure = useDisclosure({
    isOpen: open,
    defaultOpen,
    onOpenChange,
  });

  const contextValue = React.useMemo<SheetContextValue>(
    () => ({
      isOpen: open !== undefined ? open : disclosure.isOpen,
      onOpenChange: onOpenChange || disclosure.onOpenChange,
      onClose: disclosure.onClose,
    }),
    [open, onOpenChange, disclosure.isOpen, disclosure.onOpenChange, disclosure.onClose]
  );

  return <SheetContext.Provider value={contextValue}>{children}</SheetContext.Provider>;
};

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(SheetContext);
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
SheetTrigger.displayName = 'SheetTrigger';

const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(SheetContext);
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
SheetClose.displayName = 'SheetClose';

const SheetPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
const SheetOverlay: React.FC<{ className?: string }> = () => null;

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'right', className, children, ...props }, _ref) => {
    const ctx = React.useContext(SheetContext);

    return (
      <Drawer
        isOpen={ctx?.isOpen}
        onOpenChange={ctx?.onOpenChange}
        onClose={ctx?.onClose}
        placement={side}
        classNames={{
          backdrop: 'bg-black/80 backdrop-blur-sm z-50',
          wrapper: 'z-50',
          base: cn('border-card-border bg-card text-foreground shadow-lg font-sans p-6', className),
          closeButton: 'hover:bg-surface text-gold end-4 top-4 p-1.5',
          body: 'p-0 my-4',
          header: 'p-0',
          footer: 'p-0',
        }}
        {...props}
      >
        <DrawerContent>{() => <>{children}</>}</DrawerContent>
      </Drawer>
    );
  }
);
SheetContent.displayName = 'SheetContent';

const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <DrawerHeader className={cn('flex flex-col space-y-2 p-0 text-start', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <DrawerFooter
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-0', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold font-display tracking-wider text-foreground', className)}
      {...props}
    />
  )
);
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
};
