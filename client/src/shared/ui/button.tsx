import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Button as HeroUIButton } from '@heroui/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 font-data',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-gold to-gold-dark text-primary-foreground hover:from-gold-light hover:to-gold shadow-sm',
        destructive: 'bg-destructive text-foreground hover:bg-destructive/90',
        outline: 'border border-gold text-gold bg-transparent hover:bg-gold/10',
        secondary: 'bg-surface text-foreground border border-border hover:bg-border',
        ghost: 'text-foreground hover:bg-surface hover:text-gold',
        link: 'text-gold underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
      );
    }

    return (
      <HeroUIButton
        ref={ref}
        disableRipple
        isLoading={isLoading}
        isDisabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
