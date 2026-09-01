import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { restaurantApi } from '../../api/restaurantApi';
import { getImageUrl } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Star, Phone, Globe, Navigation, Search, Clock, MapPin, AlertCircle, Utensils } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

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

    if (startMins !== -1 && endMins !== -1 && currentMinutes >= startMins && currentMinutes <= endMins) {
      return true;
    }
  }

  return false;
}

export function RestaurantDetailsModal({ placeId, onClose }) {
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!placeId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    restaurantApi
      .getDetails(placeId)
      .then((data) => {
        if (isMounted) setDetails(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load details');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [placeId]);

  const priceDescriptors = {
    1: 'Inexpensive ($)',
    2: 'Moderate ($$)',
    3: 'Expensive ($$$)',
    4: 'Very Expensive ($$$$)',
  };

  const isCurrentlyOpen =
    details?.is_open !== null && details?.is_open !== undefined
      ? details.is_open
      : checkIfOpen(details?.opening_hours);

  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <Modal isOpen={!!placeId} onClose={onClose} maxWidth="max-w-2xl">
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <LoadingSpinner size="lg" className="text-brand-500" />
          <p className="text-sm font-medium">Fetching restaurant details...</p>
        </div>
      ) : error || !details ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-rose-600">
          <AlertCircle className="w-10 h-10" />
          <p className="text-sm font-medium">{error || 'Could not load details'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero Image */}
          {details.photo_url && (
            <div className="relative -mt-6 -mx-6 h-56 bg-slate-100 overflow-hidden">
              <img
                src={getImageUrl(details.photo_url)}
                alt={details.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <h2 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">
                  {details.name}
                </h2>
              </div>
            </div>
          )}

          {/* Header info (if no photo, show title here) */}
          {!details.photo_url && (
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {details.name}
              </h2>
            </div>
          )}

          {/* Meta badges row */}
          <div className="flex flex-wrap items-center gap-3">
            {details.rating && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{parseFloat(details.rating).toFixed(1)}</span>
                {details.user_rating_count && (
                  <span className="text-xs text-amber-700 font-normal">
                    ({details.user_rating_count} reviews)
                  </span>
                )}
              </div>
            )}

            {details.price_level && (
              <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {priceDescriptors[details.price_level] || '$'.repeat(details.price_level)}
              </span>
            )}

            {details.primary_type && (
              <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold capitalize flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-slate-500" />
                {details.primary_type}
              </span>
            )}

            {isCurrentlyOpen !== null && (
              <StatusBadge status={isCurrentlyOpen} type="openStatus" />
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2.5 text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
            <MapPin className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <span>{details.address || 'Address not available'}</span>
          </div>

          {/* Action Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {details.phone_number && (
              <a
                href={`tel:${details.phone_number}`}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors shadow-xs"
              >
                <Phone className="w-4 h-4 text-brand-500" />
                Call
              </a>
            )}
            {details.website_url && (
              <a
                href={details.website_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors shadow-xs"
              >
                <Globe className="w-4 h-4 text-brand-500" />
                Website
              </a>
            )}
            {details.google_maps_url && (
              <a
                href={details.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors shadow-xs"
              >
                <Navigation className="w-4 h-4 text-brand-500" />
                Directions
              </a>
            )}
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${details.name} ${details.address || ''}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors shadow-xs"
            >
              <Search className="w-4 h-4 text-brand-500" />
              Google
            </a>
          </div>

          {/* Opening Hours list */}
          {details.opening_hours && Array.isArray(details.opening_hours) && details.opening_hours.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" />
                Opening Hours
              </h4>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {details.opening_hours.map((dayStr, idx) => {
                  const isToday = dayStr.startsWith(todayDayName);
                  const colonIdx = dayStr.indexOf(':');
                  const day = colonIdx !== -1 ? dayStr.substring(0, colonIdx) : dayStr;
                  const time = colonIdx !== -1 ? dayStr.substring(colonIdx + 1).trim() : '';

                  return (
                    <li
                      key={idx}
                      className={`flex items-center justify-between p-2.5 ${
                        isToday ? 'bg-brand-50/70 font-semibold text-brand-900' : 'text-slate-700 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{day}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-brand-200 text-brand-800">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 font-medium">{time}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
