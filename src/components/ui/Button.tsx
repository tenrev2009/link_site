import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "group relative flex justify-center py-2 px-4",
          "border border-transparent text-sm font-medium rounded-md",
          "text-white bg-blue-600 hover:bg-blue-700",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          "disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);