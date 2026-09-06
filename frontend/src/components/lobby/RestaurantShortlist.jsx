import React, { useState } from 'react';
import { Star, Check, Trash2, Info, Bookmark, BookmarkCheck, Utensils, MapPin, CheckCircle2 } from 'lucide-react';
import { getImageUrl } from '../../api/client';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { restaurantApi } from '../../api/restaurantApi';
import { checkIfOpen } from '../../utils/openingHours';

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

  const maxVotes = showVotes && votes.length > 0
    ? Math.max(...options.map((opt) => votes.filter((v) => v.restaurant_id === opt.restaurant?.id).length))
    : 0;

  return (
    <div className="space-y-4">
      {/* Live Vote Progress Header during Voting Phase */}
      {isVoting && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs sm:text-sm font-heading flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tomato animate-pulse" />
            <span className="font-bold">Voting in Progress</span>
            <span className="text-slate-600 font-normal">
              · {totalVotes} of {totalMembers} members voted
            </span>
          </div>
          <div className="text-xs font-semibold text-amber-950">
            {totalVotes >= totalMembers
              ? 'All votes in · Ready to reveal winner'
              : `${totalMembers - totalVotes} vote${totalMembers - totalVotes === 1 ? '' : 's'} remaining`}
          </div>
        </div>
      )}

      {options.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <div className="w-12 h-12 rounded-full bg-tomato-light/60 text-tomato flex items-center justify-center mx-auto mb-3">
            <Utensils className="w-6 h-6" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 text-base">Your lobby shortlist is empty</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {isActive
              ? 'Click "Add to Lobby" above to search and shortlist candidate spots for the group.'
              : 'No restaurants were nominated before voting began.'}
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
            const isLeading = showVotes && maxVotes > 0 && votesForThis.length === maxVotes;

            return (
              <div
                key={opt.id || r.id}
                className={`relative bg-white rounded-2xl border overflow-hidden shadow-soft flex flex-col justify-between transition-all duration-200 ${
                  isWinning && isClosed
                    ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-50/20'
                    : isClosed && !isWinning
                    ? 'opacity-70 border-slate-200'
                    : isLeading && isVoting
                    ? 'border-tomato/40 ring-1 ring-tomato/20 hover:shadow-card'
                    : 'border-slate-200/80 hover:shadow-card'
                } ${removingId === r.id ? 'opacity-30 pointer-events-none' : ''}`}
              >
                {/* Remove button for adder during active phase */}
                {isAddedByMe && isActive && (
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-slate-100 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Remove candidate from lobby"
                    aria-label={`Remove ${r.name} from lobby`}
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

                  {/* Social Adder Tag / Leading tag */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    {adder && (
                      <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[11px] font-medium text-slate-700 shadow-xs">
                        Added by @{adder.username}
                      </div>
                    )}
                    {isLeading && isVoting && (
                      <div className="px-2 py-0.5 rounded-md bg-tomato text-white text-[10px] font-heading font-bold uppercase tracking-wide shadow-xs">
                        Leading
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-heading font-semibold text-slate-900 text-base leading-snug line-clamp-1">
                      {r.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {r.primary_type && (
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize font-medium">
                          {r.primary_type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {r.price_level && (
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {'$'.repeat(r.price_level)}
                        </span>
                      )}
                      {(() => {
                        const openStatus = (r.is_open !== null && r.is_open !== undefined) ? r.is_open : checkIfOpen(r.opening_hours);
                        return openStatus !== null && openStatus !== undefined ? (
                          <StatusBadge status={openStatus} type="openStatus" />
                        ) : null;
                      })()}
                    </div>

                    <p className="mt-2 text-xs text-slate-500 flex items-start gap-1 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{r.address || 'Address not available'}</span>
                    </p>

                    {/* Dynamic Consensus Progress Meter */}
                    {showVotes && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Group Consensus</span>
                          <span className="font-heading font-bold text-slate-800">
                            {votesForThis.length} {votesForThis.length === 1 ? 'vote' : 'votes'}
                            {totalVotes > 0 ? ` (${Math.round((votesForThis.length / totalVotes) * 100)}%)` : ''}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={votesForThis.length}
                          aria-valuemin={0}
                          aria-valuemax={totalVotes > 0 ? totalVotes : 1}
                          aria-label={`Votes for ${r.name}: ${votesForThis.length} of ${totalVotes}`}
                          className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLeading && votesForThis.length > 0 ? 'bg-tomato' : 'bg-slate-300'
                            }`}
                            style={{
                              width: `${totalVotes > 0 ? (votesForThis.length / totalVotes) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    {showVotes && !isClosed && (
                      <Button
                        variant={hasVotedForThis ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleVote(r.id)}
                        isLoading={votingId === r.id}
                        icon={hasVotedForThis ? CheckCircle2 : Check}
                        className={`flex-1 font-heading font-semibold ${
                          hasVotedForThis ? 'text-tomato border-tomato/40 bg-tomato-light/40' : ''
                        }`}
                      >
                        {hasVotedForThis ? 'Voted' : 'Vote'}
                      </Button>
                    )}

                    <Button
                      variant={isWinning && isClosed ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => openDetailsModal(r.api_place_id)}
                      icon={Info}
                      className={`font-heading font-semibold ${!showVotes || isClosed ? 'flex-1' : ''}`}
                    >
                      {isWinning && isClosed ? 'View Details' : 'Details'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave(r)}
                      disabled={isSaved}
                      icon={isSaved ? BookmarkCheck : Bookmark}
                      className={isSaved ? 'text-tomato' : 'text-slate-400 hover:text-slate-700'}
                      title={isSaved ? 'Saved to personal favorites' : 'Save to favorites'}
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
