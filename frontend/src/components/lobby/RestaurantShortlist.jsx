import React, { useState } from 'react';
import { Star, Check, Trash2, Info, Bookmark, BookmarkCheck, Utensils, MapPin, CheckCircle2 } from 'lucide-react';
import { getImageUrl } from '../../api/client';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { restaurantApi } from '../../api/restaurantApi';

export function RestaurantShortlist({
  options = [],
  votes = [],
  members = [],
  lobby,
  onVote,
  onRemove,
  isWinnerId = null,
}) {
  const { currentUser, savedPlaceIds, addSavedPlaceId } = useAuth();
  const { openDetailsModal } = useModal();
  const { showToast } = useToast();
  const [votingId, setVotingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [savingPlaceId, setSavingPlaceId] = useState(null);

  const isClosed = lobby?.status === 'closed';
  const isVoting = lobby?.status === 'voting';
  const isActive = lobby?.status === 'active';
  const showVotes = isVoting || isClosed;

  const totalMembers = members.length;
  const totalVotes = votes.length;

  const handleVote = async (restaurantId) => {
    setVotingId(restaurantId);
    try {
      await onVote(restaurantId);
      showToast('Vote recorded!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to cast vote', 'error');
    } finally {
      setVotingId(null);
    }
  };

  const handleRemove = async (restaurantId) => {
    setRemovingId(restaurantId);
    try {
      await onRemove(restaurantId);
      showToast('Restaurant removed from lobby', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to remove', 'error');
      setRemovingId(null);
    }
  };

  const handleSave = async (restaurant) => {
    if (savedPlaceIds.has(restaurant.api_place_id) || savingPlaceId === restaurant.api_place_id) return;
    setSavingPlaceId(restaurant.api_place_id);
    addSavedPlaceId(restaurant.api_place_id);

    try {
      // If needed, fetch details or save directly
      const details = await restaurantApi.getDetails(restaurant.api_place_id).catch(() => restaurant);
      await restaurantApi.saveRestaurant(details);
      showToast(`${restaurant.name} saved!`, 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPlaceId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Vote Tally Header during Voting Phase */}
      {isVoting && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-center font-bold text-amber-900 text-sm flex items-center justify-center gap-2 animate-fade-in shadow-xs">
          <span>Live Vote Progress:</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950">
            {totalVotes} / {totalMembers}
          </span>
          <span>votes cast</span>
        </div>
      )}

      {options.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Utensils className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800 text-base">No restaurants added yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {isActive
              ? 'Click "Add to Lobby" above to search and shortlist spots for the group to vote on!'
              : 'The lobby has started voting.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {options.map((opt) => {
            const r = opt.restaurant;
            const adder = opt.adder;
            const isAddedByMe = currentUser && adder && currentUser.id === adder.id;
            const photoUrl = r.photo_url ? getImageUrl(r.photo_url) : null;
            const isSaved = savedPlaceIds.has(r.api_place_id);

            const votesForThis = votes.filter((v) => v.restaurant_id === r.id);
            const hasVotedForThis = votesForThis.some(
              (v) => currentUser && v.user_id === currentUser.id
            );
            const isWinning = isWinnerId === r.id;

            return (
              <div
                key={opt.id || r.id}
                className={`relative bg-white rounded-2xl border overflow-hidden shadow-soft flex flex-col justify-between transition-all duration-200 ${
                  isWinning && isClosed
                    ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-50/20'
                    : isClosed && !isWinning
                    ? 'opacity-70 border-slate-200'
                    : 'border-slate-200/80 hover:shadow-card'
                } ${removingId === r.id ? 'opacity-30 pointer-events-none' : ''}`}
              >
                {/* Remove button for adder during active phase */}
                {isAddedByMe && isActive && (
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all"
                    title="Remove from lobby"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Top Image */}
                <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={r.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Utensils className="w-8 h-8 stroke-1 text-slate-300" />
                    </div>
                  )}

                  {/* Rating Badge on Photo */}
                  {r.rating && (
                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{parseFloat(r.rating).toFixed(1)}</span>
                    </div>
                  )}

                  {/* Adder tag */}
                  {adder && (
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[11px] font-medium text-slate-700 shadow-xs">
                      Added by @{adder.username}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">
                      {r.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {r.primary_type && (
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize font-medium">
                          {r.primary_type}
                        </span>
                      )}
                      {r.price_level && (
                        <span className="text-xs font-bold text-emerald-700">
                          {'$'.repeat(r.price_level)}
                        </span>
                      )}
                      {r.is_open !== null && r.is_open !== undefined && (
                        <StatusBadge status={r.is_open} type="openStatus" />
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-500 flex items-start gap-1 line-clamp-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span>{r.address || 'Address not available'}</span>
                    </p>

                    {/* Vote Count Indicator */}
                    {showVotes && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 font-bold text-xs">
                        <span>Votes:</span>
                        <span className="text-sm">{votesForThis.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    {showVotes && !isClosed && (
                      <Button
                        variant={hasVotedForThis ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => handleVote(r.id)}
                        isLoading={votingId === r.id}
                        icon={hasVotedForThis ? CheckCircle2 : null}
                        className="flex-1 font-bold"
                      >
                        {hasVotedForThis ? 'Voted' : 'Vote'}
                      </Button>
                    )}

                    <Button
                      variant={isWinning && isClosed ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => openDetailsModal(r.api_place_id)}
                      icon={Info}
                      className={!showVotes || isClosed ? 'flex-1' : ''}
                    >
                      {isWinning && isClosed ? 'View Details' : 'Details'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave(r)}
                      disabled={isSaved}
                      icon={isSaved ? BookmarkCheck : Bookmark}
                      className={isSaved ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'}
                      title={isSaved ? 'Already saved' : 'Save to favorites'}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
