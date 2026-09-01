import React from 'react';
import { Crown, Info } from 'lucide-react';
import { Button } from '../common/Button';
import { useModal } from '../../hooks/useModal';

export function WinnerSpotlight({ winningOption, voteCount }) {
  const { openDetailsModal } = useModal();
  if (!winningOption) return null;

  const restaurant = winningOption.restaurant;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-brand-500 to-amber-600 p-6 text-white shadow-card animate-fade-in mb-6">
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-200 shrink-0 shadow-inner">
            <Crown className="w-8 h-8 drop-shadow" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-bold tracking-wide uppercase text-amber-100 mb-1">
              Tonight's Pick • Winner
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">
              {restaurant.name}
            </h3>
            <p className="text-sm text-amber-100 font-medium mt-0.5">
              The group has chosen! Won with <strong>{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</strong>.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={() => openDetailsModal(restaurant.api_place_id)}
          icon={Info}
          className="bg-white text-slate-900 hover:bg-amber-50 shadow-md font-bold shrink-0"
        >
          View Details & Hours
        </Button>
      </div>
    </div>
  );
}
