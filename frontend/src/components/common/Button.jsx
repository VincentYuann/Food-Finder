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
  const baseClasses = 'inline-flex items-center justify-center font-heading font-medium tracking-tight rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantClasses = {
    primary: 'bg-tomato hover:bg-tomato-hover active:bg-brand-700 text-white shadow-xs hover:shadow-md hover:shadow-tomato/20 hover:-translate-y-0.5 focus:ring-tomato/40',
    secondary: 'bg-slate-100 hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 focus:ring-slate-300 border border-slate-200/80',
    outline: 'bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 focus:ring-slate-300 shadow-xs hover:-translate-y-0.5',
    ghost: 'bg-transparent hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
    danger: 'bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-200/70 focus:ring-red-300',
    warning: 'bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border border-amber-200/70 focus:ring-amber-300',
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
