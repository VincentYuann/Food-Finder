import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
        <UtensilsCrossed className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">404</h1>
      <h2 className="text-lg font-bold text-slate-700 mt-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link to="/">
        <Button variant="primary" size="md" icon={Home}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
