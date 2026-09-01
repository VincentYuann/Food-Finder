import React, { useState } from 'react';
import { Star, MapPin, Trash2, Info, Utensils } from 'lucide-react';
import { getImageUrl } from '../../api/client';
import { Button } from '../common/Button';
import { useModal } from '../../hooks/useModal';

export function SavedRestaurantItem({ restaurant, onUnsave }) {
  const { openDetailsModal } = useModal();
  const [imageError, setImageError] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onUnsave(restaurant.id, restaurant.api_place_id);
    } catch (err) {
      console.error(err);
      setIsRemoving(false);
    }
  };

  const photoUrl = !imageError && restaurant.photo_url ? getImageUrl(restaurant.photo_url) : null;

  return (
    <div className={`p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/70 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isRemoving ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Photo thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={restaurant.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Utensils className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Text info */}
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-900 text-sm truncate">{restaurant.name}</h4>
          <p className="text-xs text-slate-500 truncate mt-0.5">{restaurant.address || 'No address'}</p>
          <div className="flex items-center gap-2 mt-1">
            {restaurant.rating && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {parseFloat(restaurant.rating).toFixed(1)}
              </span>
            )}
            {restaurant.primary_type && (
              <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                {restaurant.primary_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDetailsModal(restaurant.api_place_id)}
          icon={Info}
        >
          Details
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleRemove}
          isLoading={isRemoving}
          icon={Trash2}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
