import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { restaurantApi } from '../../api/restaurantApi';
import { getImageUrl } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  Star,
  Phone,
  Globe,
  Navigation,
  Clock,
  MapPin,
  AlertCircle,
  Utensils,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useRestaurantDetails, useSaveRestaurantMutation } from '../../hooks/useRestaurantsQuery';

function checkIfOpen(openingHoursArray) {
  if (!openingHoursArray || !Array.isArray(openingHoursArray) || openingHoursArray.length === 0) return null;

  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const todayStr = openingHoursArray.find((str) => str.startsWith(dayName));

  if (!todayStr) return null;

  const hoursPart = todayStr.substring(todayStr.indexOf(':') + 1).trim();
  if (hoursPart === 'Closed') return false;
  if (hoursPart === 'Open 24 hours') return true;

  const ranges = hoursPart.split(',').map((s) => s.trim());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const range of ranges) {
    const parts = range.split(/[\u2013\-]/).map((s) => s.trim());
    if (parts.length !== 2) continue;

    const parseTime = (timeStr) => {
      const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
      if (!match) return -1;
      let hours = parseInt(match[1], 10);
      const mins = match[2] ? parseInt(match[2], 10) : 0;
      const isPM = match[3].toUpperCase() === 'PM';
      if (hours === 12 && !isPM) hours = 0;
      else if (hours < 12 && isPM) hours += 12;
      return hours * 60 + mins;
    };

    let startMins = parseTime(parts[0]);
    let endMins = parseTime(parts[1]);

    if (startMins !== -1 && endMins !== -1 && !parts[0].toLowerCase().includes('m') && parts[1].toLowerCase().includes('m')) {
      const isEndPM = parts[1].toLowerCase().includes('pm');
      if (isEndPM && startMins < 12 * 60 && startMins + 12 * 60 < endMins) {
        startMins += 12 * 60;
      }
    }

    if (startMins !== -1 && endMins !== -1) {
      if (endMins < startMins) {
        // Range crosses midnight (e.g. 11:30 AM to 2:00 AM)
        if (currentMinutes >= startMins || currentMinutes <= endMins) {
          return true;
        }
      } else {
        if (currentMinutes >= startMins && currentMinutes <= endMins) {
          return true;
        }
      }
    }
  }

  return false;
}

export function RestaurantDetailsModal({ placeId, onClose }) {
  const { data: details, isLoading, error: queryError } = useRestaurantDetails(placeId);
  const error = queryError ? (queryError.message || 'Failed to load details') : null;
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { savedPlaceIds, addSavedPlaceId } = useAuth();
  const { showToast } = useToast();
  const saveMutation = useSaveRestaurantMutation();


  const priceDescriptors = {
    1: 'Inexpensive',
    2: 'Moderate',
    3: 'Expensive',
    4: 'Very Expensive',
  };

  const isCurrentlyOpen =
    details?.is_open !== null && details?.is_open !== undefined
      ? details.is_open
      : checkIfOpen(details?.opening_hours);

  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayEntry = details?.opening_hours?.find((str) => str.startsWith(todayDayName));
  const todayHoursStr = todayEntry
    ? todayEntry.substring(todayEntry.indexOf(':') + 1).trim()
    : null;

  const isSaved = details && savedPlaceIds.has(details.api_place_id);

  const handleSaveToggle = async () => {
    if (!details || isSaving) return;

    if (isSaved) {
      showToast(`${details.name} is already in your saved list`, 'info');
      return;
    }

    setIsSaving(true);
    addSavedPlaceId(details.api_place_id);

    try {
      await saveMutation.mutateAsync({
        api_place_id: details.api_place_id,
        name: details.name,
        address: details.address,
        latitude: details.latitude,
        longitude: details.longitude,
        rating: details.rating,
        price_level: details.price_level,
        photo_url: details.photo_url,
        primary_type: details.primary_type,
        user_rating_count: details.user_rating_count,
      });
      showToast(`${details.name} saved to favorites!`, 'success');
    } catch (err) {
      console.error('Failed to save restaurant:', err);
      showToast(err.message || 'Failed to save restaurant', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!placeId}
      onClose={onClose}
      maxWidth="max-w-xl"
      headerless
      showCloseButton
      ariaLabel={details?.name || 'Restaurant details'}
    >
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
          <LoadingSpinner size="lg" className="text-tomato" />
          <p className="text-sm font-medium font-heading">Loading restaurant details...</p>
        </div>
      ) : error || !details ? (
        <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 text-base">Could not load details</h4>
          <p className="text-xs text-slate-500 max-w-xs">{error || 'Please check your connection and try again.'}</p>
          <button
            type="button"
            onClick={fetchDetails}
            className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div>
          {/* Full Bleed Hero Banner */}
          {details.photo_url ? (
            <div className="relative h-60 sm:h-64 w-full bg-slate-100 overflow-hidden">
              <img
                src={getImageUrl(details.photo_url)}
                alt={details.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 pointer-events-none" />
            </div>
          ) : (
            <div className="h-32 w-full bg-tomato-light/40 flex items-center justify-center text-tomato">
              <Utensils className="w-10 h-10 opacity-70" />
            </div>
          )}

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Title & Identity Header */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight leading-snug">
                {details.name}
              </h2>

              {details.address && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{details.address}</span>
                </div>
              )}

              {/* Harmonized Metadata Badges Row */}
              <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                {/* Live Status Badge */}
                {isCurrentlyOpen !== null && (
                  <StatusBadge status={isCurrentlyOpen} type="openStatus" />
                )}

                {/* Rating Badge (Star Gold) */}
                {details.rating && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs font-bold font-heading">
                    <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                    <span>{parseFloat(details.rating).toFixed(1)}</span>
                    {details.user_rating_count && (
                      <span className="text-[11px] font-normal text-slate-600">
                        ({details.user_rating_count.toLocaleString()})
                      </span>
                    )}
                  </div>
                )}

                {/* Price Badge */}
                {details.price_level && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                    {'$'.repeat(details.price_level)} · {priceDescriptors[details.price_level] || 'Moderate'}
                  </span>
                )}

                {/* Cuisine / Category */}
                {details.primary_type && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold capitalize flex items-center gap-1.5">
                    <Utensils className="w-3 h-3 text-slate-500" />
                    {details.primary_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                {/* Primary CTA: Get Directions */}
                {details.google_maps_url && (
                  <a
                    href={details.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-tomato hover:bg-tomato-hover active:scale-[0.99] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-tomato focus:ring-offset-2"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Get Directions</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                  </a>
                )}

                {/* Core App CTA: Save Spot */}
                <button
                  type="button"
                  onClick={handleSaveToggle}
                  disabled={isSaving}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-tomato focus:ring-offset-2 active:scale-[0.99] ${
                    isSaved
                      ? 'bg-tomato-light/60 border-tomato/40 text-tomato hover:bg-tomato-light'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {isSaved ? (
                    <BookmarkCheck className="w-4 h-4 text-tomato" />
                  ) : (
                    <Bookmark className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{isSaved ? 'Saved' : 'Save Spot'}</span>
                </button>
              </div>

              {/* Secondary Actions: Call & Website */}
              <div className="flex items-center gap-2.5">
                {details.phone_number && (
                  <a
                    href={`tel:${details.phone_number}`}
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-tomato active:scale-[0.99]"
                  >
                    <Phone className="w-3.5 h-3.5 text-tomato" />
                    <span>Call {details.phone_number}</span>
                  </a>
                )}
                {details.website_url && (
                  <a
                    href={details.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-tomato active:scale-[0.99]"
                  >
                    <Globe className="w-3.5 h-3.5 text-tomato" />
                    <span>Website</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
              </div>
            </div>

            {/* Opening Hours with Progressive Disclosure */}
            {details.opening_hours && Array.isArray(details.opening_hours) && details.opening_hours.length > 0 && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-heading font-bold text-slate-900">
                    <Clock className="w-4 h-4 text-tomato" />
                    <span>Hours of Operation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHoursExpanded(!isHoursExpanded)}
                    aria-expanded={isHoursExpanded}
                    aria-controls="weekly-hours-list"
                    className="text-xs font-semibold text-slate-600 hover:text-tomato py-1.5 px-2.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-tomato/20"
                  >
                    <span>{isHoursExpanded ? 'Hide schedule' : 'View full week'}</span>
                    {isHoursExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Today's single row summary */}
                <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-tomato-light/40 border border-tomato/15">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-slate-900">{todayDayName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-heading font-bold uppercase bg-tomato text-white">
                      Today
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800">{todayHoursStr || 'Hours not listed'}</span>
                </div>

                {/* Expandable 7-day schedule */}
                {isHoursExpanded && (
                  <ul id="weekly-hours-list" className="divide-y divide-slate-100 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    {details.opening_hours.map((dayStr, idx) => {
                      const isToday = dayStr.startsWith(todayDayName);
                      const colonIdx = dayStr.indexOf(':');
                      const day = colonIdx !== -1 ? dayStr.substring(0, colonIdx) : dayStr;
                      const time = colonIdx !== -1 ? dayStr.substring(colonIdx + 1).trim() : '';

                      return (
                        <li
                          key={idx}
                          className={`flex items-center justify-between py-1.5 px-2 rounded ${
                            isToday ? 'bg-slate-50 font-semibold text-slate-900' : ''
                          }`}
                        >
                          <span>{day}</span>
                          <span className="text-slate-600 font-medium">{time}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
