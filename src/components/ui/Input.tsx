import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "appearance-none relative block w-full px-3 py-2 border border-gray-300",
          "placeholder-gray-500 text-gray-900",
          "focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10",
          "sm:text-sm",
          className
        )}
        {...props}
      />
    );
  }
);