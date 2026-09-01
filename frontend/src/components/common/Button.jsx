import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon: Icon,
  onClick,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm hover:shadow focus:ring-brand-400',
    secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 focus:ring-slate-400 border border-slate-200',
    danger: 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-sm focus:ring-rose-400',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm focus:ring-amber-400',
    outline: 'bg-transparent border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 focus:ring-brand-400',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : Icon ? (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      ) : null}
      {children}
    </button>
  );
}
