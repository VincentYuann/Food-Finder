import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Navigation, SlidersHorizontal, Utensils, X, CheckCircle2, Share2 } from 'lucide-react';
import { RestaurantCard } from '../components/restaurants/RestaurantCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useGeolocation } from '../hooks/useGeolocation';
import { useToast } from '../hooks/useToast';
import { useRestaurantSearch } from '../hooks/useRestaurantsQuery';

const CUISINES = [
  'All Cuisines',
  'Italian',
  'Japanese',
  'Mexican',
  'Chinese',
  'Indian',
  'American',
  'Thai',
  'Korean',
  'Pizza',
  'Burger',
  'Sushi',
  'Ramen',
  'Cafe',
  'Bakery',
  'Seafood',
  'Mediterranean',
  'Vietnamese',
  'BBQ',
  'Vegetarian',
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { location, isLocating, locationError, requestLocation, clearLocation } = useGeolocation();

  // Read active filter values from URL query parameters
  const activeQuery = searchParams.get('q') || '';
  const activeCuisine = searchParams.get('cuisine') || 'All Cuisines';
  const activeRadius = Number(searchParams.get('radius')) || 5;

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const coordsFromUrl =
    latParam && lngParam && !isNaN(Number(latParam)) && !isNaN(Number(lngParam))
      ? { latitude: Number(latParam), longitude: Number(lngParam) }
      : null;

  const effectiveLocation = coordsFromUrl || location;

  // Form input state (pending user edits before pressing Filter)
  const [query, setQuery] = useState(activeQuery);
  const [cuisine, setCuisine] = useState(activeCuisine);
  const [radius, setRadius] = useState(activeRadius);

  // Sync inputs when URL searchParams change (e.g. browser back/forward buttons)
  useEffect(() => {
    setQuery(activeQuery);
    setCuisine(activeCuisine);
    setRadius(activeRadius);
  }, [activeQuery, activeCuisine, activeRadius]);

  useEffect(() => {
    if (locationError) {
      showToast(locationError, 'error');
    }
  }, [locationError, showToast]);

  // TanStack Query for Search Results with in-memory caching across navigation
  const {
    data: results = [],
    isLoading,
    isFetching,
    error: searchError,
  } = useRestaurantSearch({
    query: activeQuery,
    cuisine: activeCuisine,
    radius: activeRadius,
    latitude: effectiveLocation?.latitude,
    longitude: effectiveLocation?.longitude,
  });

  useEffect(() => {
    if (searchError) {
      showToast(searchError.message || 'Search failed', 'error');
    }
  }, [searchError, showToast]);

  const hasSearched = Boolean(
    activeQuery || (activeCuisine && activeCuisine !== 'All Cuisines') || effectiveLocation
  );

  // Trigger search on clicking Filter / pressing Enter by updating URL params
  const handleApplyFilters = (e) => {
    e?.preventDefault();

    const nextParams = {};
    if (query.trim()) nextParams.q = query.trim();
    if (cuisine && cuisine !== 'All Cuisines') nextParams.cuisine = cuisine;
    if (radius && radius !== 5) nextParams.radius = String(radius);
    if (location) {
      nextParams.lat = location.latitude.toFixed(6);
      nextParams.lng = location.longitude.toFixed(6);
    }

    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    setQuery('');
    setCuisine('All Cuisines');
    setRadius(5);
    clearLocation();
    setSearchParams({});
  };

  const handlePresetSelect = (presetRadius) => {
    setRadius(presetRadius);
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 tracking-tight">
            Discover Great Places to Eat
          </h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Search top-rated spots by name, cuisine, or your live GPS location.
          </p>
        </div>

        {/* Search Controls Form */}
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Keyword search */}
            <div className="sm:col-span-6 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search restaurant name, food, or keywords..."
                aria-label="Search restaurant name, food, or keywords"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors font-medium"
              />
            </div>

            {/* Cuisine Dropdown Selector */}
            <div className="sm:col-span-3">
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                aria-label="Filter by cuisine"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-slate-50/60 focus:bg-white text-slate-800 font-semibold transition-colors"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons: Filter & Reset */}
            <div className="sm:col-span-3 flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                icon={SlidersHorizontal}
                className="flex-1 shadow-sm hover:shadow-glow-tomato py-2.5"
              >
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleResetFilters}
                className="px-3 text-slate-600 hover:text-slate-900"
                title="Reset all filters"
                aria-label="Reset all filters"
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Location & Radius Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {location ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">
                    {location.areaName ? `Near ${location.areaName}` : 'Location Acquired'}
                  </span>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="ml-1 text-emerald-600 hover:text-emerald-900 shrink-0"
                    title="Clear location"
                    aria-label="Clear GPS location"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestLocation}
                  isLoading={isLocating}
                  icon={Navigation}
                  className="text-xs font-medium"
                >
                  Use My Current Location
                </Button>
              )}
            </div>

            {location && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Radius: <strong className="text-slate-900 font-semibold">{radius} mi</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    aria-label="Search radius in miles"
                    aria-valuenow={radius}
                    aria-valuemin="1"
                    aria-valuemax="25"
                    className="w-24 sm:w-28 accent-tomato cursor-pointer"
                  />
                  {/* Quick Distance Presets (only sets radius, search happens on Filter click) */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: '2 mi', val: 2 },
                      { label: '5 mi', val: 5 },
                      { label: '15 mi', val: 15 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handlePresetSelect(p.val)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                          radius === p.val
                            ? 'bg-tomato-light text-tomato border border-tomato/30 font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold text-slate-900 flex items-center gap-2">
          <Utensils className="w-5 h-5 text-tomato" />
          <span>{hasSearched ? `Results (${results.length})` : 'Popular Restaurants'}</span>
        </h2>

        {/* Shareable Link Button */}
        {hasSearched && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast('Link copied! You can share these filters with anyone.', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
            title="Copy URL with current filters"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Share Filters</span>
          </button>
        )}
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-tomato gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Searching delicious spots...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-tomato-light/60 text-tomato flex items-center justify-center mx-auto mb-3">
            <Utensils className="w-6 h-6" />
          </div>
          <h3 className="text-base font-heading font-bold text-slate-800">No restaurants found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Try adjusting your search query, choosing another cuisine, or expanding your radius.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
            {location && radius < 15 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setRadius(15);
                  const nextParams = {};
                  if (query.trim()) nextParams.q = query.trim();
                  if (cuisine && cuisine !== 'All Cuisines') nextParams.cuisine = cuisine;
                  nextParams.radius = '15';
                  if (location) {
                    nextParams.lat = location.latitude.toFixed(6);
                    nextParams.lng = location.longitude.toFixed(6);
                  }
                  setSearchParams(nextParams);
                }}
              >
                Expand to 15 miles
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((restaurant) => (
            <RestaurantCard
              key={restaurant.api_place_id}
              restaurant={restaurant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
