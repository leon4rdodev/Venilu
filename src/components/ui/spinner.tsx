import React from 'react';
import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps extends Omit<React.ComponentProps<'svg'>, 'width' | 'height'> {
  size?: 'small' | 'medium' | 'large';
}

function Spinner({ className, size, ...props }: SpinnerProps) {
  const sizeClasses = {
    small: 'size-4',
    medium: 'size-6',
    large: 'size-8'
  };

  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn('animate-spin', size ? sizeClasses[size] : 'size-4', className)}
      {...props}
    />
  )
}

export { Spinner }
