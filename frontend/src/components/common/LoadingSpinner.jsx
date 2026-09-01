import React from 'react';

export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
