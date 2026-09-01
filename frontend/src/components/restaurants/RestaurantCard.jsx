import React, { useState } from 'react';
import { Star, MapPin, Bookmark, BookmarkCheck, Utensils, Info } from 'lucide-react';
import { getImageUrl } from '../../api/client';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { restaurantApi } from '../../api/restaurantApi';

export function RestaurantCard({
  restaurant,
  actions,
  isSaved: explicitSaved,
  onSaveSuccess,
  className = '',
}) {
  const { savedPlaceIds, addSavedPlaceId } = useAuth();
  const { openDetailsModal } = useModal();
  const { showToast } = useToast();
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSaved = explicitSaved ?? (restaurant.saved || savedPlaceIds.has(restaurant.api_place_id));

  const handleSave = async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);
    addSavedPlaceId(restaurant.api_place_id);

    try {
      await restaurantApi.saveRestaurant({
        api_place_id: restaurant.api_place_id,
        name: restaurant.name,
        address: restaurant.address,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        rating: restaurant.rating,
        price_level: restaurant.price_level,
        photo_url: restaurant.photo_url,
        primary_type: restaurant.primary_type,
        user_rating_count: restaurant.user_rating_count,
      });
      showToast(`${restaurant.name} saved!`, 'success');
      if (onSaveSuccess) onSaveSuccess(restaurant.api_place_id);
    } catch (err) {
      console.error('Save error:', err);
      // Keep optimistic saved state per requirements
    } finally {
      setIsSaving(false);
    }
  };

  const photoUrl = !imageError && restaurant.photo_url ? getImageUrl(restaurant.photo_url) : null;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-ambient hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col ${className}`}>
      {/* Image container */}
      <div
        className="relative h-44 w-full bg-slate-100 overflow-hidden cursor-pointer group"
        onClick={() => openDetailsModal(restaurant.api_place_id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && openDetailsModal(restaurant.api_place_id)}
        aria-label={`View details for ${restaurant.name}`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={restaurant.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100/80">
            <Utensils className="w-8 h-8 stroke-1 text-slate-300 mb-1" />
            <span className="text-xs font-medium text-slate-400">No photo available</span>
          </div>
        )}

        {/* Rating pill on image */}
        {restaurant.rating && (
          <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1 shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{parseFloat(restaurant.rating).toFixed(1)}</span>
            {restaurant.user_rating_count && (
              <span className="text-slate-400 font-normal">({restaurant.user_rating_count})</span>
            )}
          </div>
        )}

        {/* Price Tag on image */}
        {restaurant.price_level && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-slate-900/75 backdrop-blur-md text-white text-xs font-semibold">
            {'$'.repeat(restaurant.price_level)}
          </div>
        )}
      </div>

      {/* Body info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4
              onClick={() => openDetailsModal(restaurant.api_place_id)}
              className="font-heading font-semibold text-slate-900 text-base leading-snug line-clamp-1 cursor-pointer hover:text-tomato transition-colors"
            >
              {restaurant.name}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {restaurant.primary_type && (
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                {restaurant.primary_type.replace(/_/g, ' ')}
              </span>
            )}
            {restaurant.is_open !== null && restaurant.is_open !== undefined && (
              <StatusBadge status={restaurant.is_open} type="openStatus" />
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500 flex items-start gap-1 line-clamp-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{restaurant.address || 'Address not available'}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
          {actions ? (
            actions
          ) : (
            <>
              <Button
                variant={isSaved ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleSave}
                disabled={isSaved || isSaving}
                icon={isSaved ? BookmarkCheck : Bookmark}
                className={`flex-1 min-h-[38px] ${isSaved ? 'text-tomato bg-tomato-light/40 border-tomato/20' : ''}`}
              >
                {isSaved ? 'Saved' : 'Save'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDetailsModal(restaurant.api_place_id)}
                icon={Info}
                className="flex-1 min-h-[38px]"
              >
                Details
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
