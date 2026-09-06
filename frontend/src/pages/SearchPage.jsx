import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Navigation,
  SlidersHorizontal,
  Utensils,
  X,
  CheckCircle2,
  Share2,
  MapPin,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { RestaurantCard } from '../components/restaurants/RestaurantCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useGeolocation } from '../hooks/useGeolocation';
import { useToast } from '../hooks/useToast';
import { useRestaurantSearch } from '../hooks/useRestaurantsQuery';
import { geocodeLocation } from '../utils/geocoding';

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
  const { location: gpsLocation, isLocating, locationError, requestLocation, clearLocation: clearGpsLocation } = useGeolocation();

  // Read active filter values from URL query parameters
  const activeQuery = searchParams.get('q') || '';
  const activeCuisine = searchParams.get('cuisine') || 'All Cuisines';
  const activeRadius = Number(searchParams.get('radius')) || 5;
  const activeLocationName = searchParams.get('loc') || '';

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const coordsFromUrl = useMemo(() => {
    return latParam && lngParam && !isNaN(Number(latParam)) && !isNaN(Number(lngParam))
      ? {
          latitude: Number(latParam),
          longitude: Number(lngParam),
          areaName: activeLocationName || null,
        }
      : null;
  }, [latParam, lngParam, activeLocationName]);

  // Form input state (pending user edits before pressing Filter)
  const [query, setQuery] = useState(activeQuery);
  const [cuisine, setCuisine] = useState(activeCuisine);
  const [radius, setRadius] = useState(activeRadius);
  const [locationInput, setLocationInput] = useState(activeLocationName);
  const [customLocation, setCustomLocation] = useState(coordsFromUrl);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const gpsRequestedRef = useRef(false);

  // Sorting state: 'recommended' (Google relevance/quality) vs 'nearest' (physical distance)
  const [sortBy, setSortBy] = useState('recommended');

  // Pagination state: start with 18, allow loading up to 36 max
  const [visibleCount, setVisibleCount] = useState(18);

  // Sync inputs when URL searchParams change (e.g. browser back/forward buttons, filter applies)
  useEffect(() => {
    setQuery(activeQuery);
    setCuisine(activeCuisine);
    setRadius(activeRadius);
    setLocationInput(activeLocationName);
    setCustomLocation(coordsFromUrl);
  }, [activeQuery, activeCuisine, activeRadius, activeLocationName, coordsFromUrl]);

  // Handle live GPS response when user explicitly taps "Use My Current GPS"
  useEffect(() => {
    if (gpsLocation && gpsRequestedRef.current) {
      gpsRequestedRef.current = false;
      const area = gpsLocation.areaName || '';
      setLocationInput(area);
      setCustomLocation(gpsLocation);

      // Immediately apply to URL search parameters
      const nextParams = {};
      if (activeQuery) nextParams.q = activeQuery;
      if (activeCuisine && activeCuisine !== 'All Cuisines') nextParams.cuisine = activeCuisine;
      if (activeRadius && activeRadius !== 5) nextParams.radius = String(activeRadius);
      nextParams.lat = gpsLocation.latitude.toFixed(6);
      nextParams.lng = gpsLocation.longitude.toFixed(6);
      if (area) nextParams.loc = area;
      setSearchParams(nextParams);
      showToast(area ? `Found your location near ${area}` : 'Found your GPS location', 'success');
    }
  }, [gpsLocation, activeQuery, activeCuisine, activeRadius, setSearchParams, showToast]);

  useEffect(() => {
    if (locationError) {
      showToast(locationError, 'error');
    }
  }, [locationError, showToast]);

  // TanStack Query for Search Results with in-memory caching across navigation
  const activeTargetLocation = coordsFromUrl;

  const {
    data: rawResults = [],
    isLoading,
    isFetching,
    error: searchError,
  } = useRestaurantSearch({
    query: activeQuery,
    cuisine: activeCuisine,
    radius: activeRadius,
    latitude: activeTargetLocation?.latitude,
    longitude: activeTargetLocation?.longitude,
  });

  // Reset visibleCount back to 18 whenever search parameters change
  useEffect(() => {
    setVisibleCount(18);
  }, [activeQuery, activeCuisine, activeRadius, activeTargetLocation?.latitude, activeTargetLocation?.longitude]);

  useEffect(() => {
    if (searchError) {
      showToast(searchError.message || 'Search failed', 'error');
    }
  }, [searchError, showToast]);

  // Sort results according to sortBy toggle
  const sortedResults = useMemo(() => {
    if (!rawResults || rawResults.length === 0) return [];
    const list = [...rawResults];

    if (sortBy === 'nearest') {
      return list.sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
    }

    // Default: 'recommended' (preserves Google's algorithmic quality ranking)
    return list.sort((a, b) => (a.relevanceIndex ?? 0) - (b.relevanceIndex ?? 0));
  }, [rawResults, sortBy]);

  // Cap at 36 maximum
  const maxDisplayable = Math.min(sortedResults.length, 36);
  const displayResults = sortedResults.slice(0, Math.min(visibleCount, maxDisplayable));
  const remainingCount = maxDisplayable - displayResults.length;
  const nextBatchCount = Math.min(18, remainingCount);

  const hasSearched = Boolean(
    activeQuery || (activeCuisine && activeCuisine !== 'All Cuisines') || activeTargetLocation
  );

  // Trigger search on clicking Filter / pressing Enter
  const handleApplyFilters = async (e) => {
    e?.preventDefault();

    let targetCoords = null;

    // If user provided a location string
    if (locationInput.trim()) {
      if (
        customLocation &&
        customLocation.areaName &&
        customLocation.areaName.toLowerCase() === locationInput.trim().toLowerCase()
      ) {
        targetCoords = customLocation;
      } else {
        setIsGeocoding(true);
        const geocoded = await geocodeLocation(locationInput.trim());
        setIsGeocoding(false);

        if (geocoded) {
          targetCoords = geocoded;
          setCustomLocation(geocoded);
          showToast(`Located near ${geocoded.areaName}`, 'success');
        } else {
          showToast(`Could not find "${locationInput}". Searching without location filter.`, 'error');
        }
      }
    } else {
      // User erased or left location input empty - clear location
      setCustomLocation(null);
      clearGpsLocation();
    }

    const nextParams = {};
    if (query.trim()) nextParams.q = query.trim();
    if (cuisine && cuisine !== 'All Cuisines') nextParams.cuisine = cuisine;
    if (radius && radius !== 5) nextParams.radius = String(radius);

    if (targetCoords) {
      nextParams.lat = targetCoords.latitude.toFixed(6);
      nextParams.lng = targetCoords.longitude.toFixed(6);
      if (targetCoords.areaName) {
        nextParams.loc = targetCoords.areaName;
      }
    }

    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    setQuery('');
    setCuisine('All Cuisines');
    setRadius(5);
    setLocationInput('');
    setCustomLocation(null);
    clearGpsLocation();
    setSearchParams({});
    setVisibleCount(18);
  };

  const handleClearLocation = () => {
    setLocationInput('');
    setCustomLocation(null);
    clearGpsLocation();

    const nextParams = {};
    if (query.trim()) nextParams.q = query.trim();
    if (cuisine && cuisine !== 'All Cuisines') nextParams.cuisine = cuisine;
    setSearchParams(nextParams);
  };

  const handleUseGps = () => {
    gpsRequestedRef.current = true;
    requestLocation();
  };

  const handleRadiusCommit = (newVal) => {
    const nextParams = Object.fromEntries(searchParams.entries());
    if (newVal === 5) {
      delete nextParams.radius;
    } else {
      nextParams.radius = String(newVal);
    }
    setSearchParams(nextParams);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 18, 36));
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
            Search top-rated spots by name, cuisine, neighborhood, or your live GPS location.
          </p>
        </div>

        {/* Search Controls Form */}
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Keyword search */}
            <div className="sm:col-span-4 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Food or restaurant (e.g. ramen)..."
                aria-label="Search restaurant name, food, or keywords"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors font-medium"
              />
            </div>

            {/* Neighborhood / Custom Location search */}
            <div className="sm:col-span-4 relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Neighborhood or city (e.g. UCity, Fishtown)..."
                aria-label="Neighborhood or city"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors font-medium"
              />
              {locationInput && (
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                  title="Clear location input"
                  aria-label="Clear location input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Cuisine Dropdown Selector */}
            <div className="sm:col-span-2">
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                aria-label="Filter by cuisine"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-slate-50/60 focus:bg-white text-slate-800 font-semibold transition-colors"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons: Filter & Reset */}
            <div className="sm:col-span-2 flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading || isGeocoding}
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
              {activeTargetLocation ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">
                    {activeTargetLocation.areaName ? `Near ${activeTargetLocation.areaName}` : 'Location Active'}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="ml-1 text-emerald-600 hover:text-emerald-900 shrink-0"
                    title="Clear location"
                    aria-label="Clear active location"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseGps}
                  isLoading={isLocating}
                  icon={Navigation}
                  className="text-xs font-medium"
                >
                  Use My Current GPS
                </Button>
              )}
            </div>

            {/* Radius controls (active whenever a location is selected) */}
            {activeTargetLocation && (
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
                    onPointerUp={(e) => handleRadiusCommit(Number(e.target.value))}
                    onTouchEnd={(e) => handleRadiusCommit(Number(e.target.value))}
                    onKeyUp={(e) => {
                      if (e.key.startsWith('Arrow')) {
                        handleRadiusCommit(Number(e.target.value));
                      }
                    }}
                    aria-label="Search radius in miles"
                    aria-valuenow={radius}
                    aria-valuemin="1"
                    aria-valuemax="25"
                    className="w-24 sm:w-28 accent-tomato cursor-pointer"
                  />
                  {/* Quick Distance Presets */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: '1 mi • Close', val: 1 },
                      { label: '2 mi • Walk', val: 2 },
                      { label: '5 mi • Local', val: 5 },
                      { label: '15 mi • Metro', val: 15 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => {
                          setRadius(p.val);
                          handleRadiusCommit(p.val);
                        }}
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

      {/* Results Header with Count and Sort Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-heading font-bold text-slate-900 flex items-center gap-2">
          <Utensils className="w-5 h-5 text-tomato" />
          <span>{hasSearched ? `Results (${displayResults.length} of ${maxDisplayable})` : 'Popular Restaurants'}</span>
        </h2>

        <div className="flex items-center gap-3">
          {/* Sort By Toggle: Recommended vs Nearest */}
          {activeTargetLocation && (
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSortBy('recommended')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  sortBy === 'recommended'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sort by Google's top-rated and most relevant places"
              >
                <Sparkles className={`w-3.5 h-3.5 ${sortBy === 'recommended' ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>Recommended</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('nearest')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  sortBy === 'nearest'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sort strictly by distance from search center"
              >
                <MapPin className={`w-3.5 h-3.5 ${sortBy === 'nearest' ? 'text-tomato' : 'text-slate-400'}`} />
                <span>Nearest</span>
              </button>
            </div>
          )}

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
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-tomato gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Searching delicious spots...</p>
        </div>
      ) : displayResults.length === 0 ? (
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
            {activeTargetLocation && radius < 15 && (
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
                  if (activeTargetLocation) {
                    nextParams.lat = activeTargetLocation.latitude.toFixed(6);
                    nextParams.lng = activeTargetLocation.longitude.toFixed(6);
                    if (activeTargetLocation.areaName) nextParams.loc = activeTargetLocation.areaName;
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayResults.map((restaurant) => (
              <RestaurantCard
                key={restaurant.api_place_id}
                restaurant={restaurant}
              />
            ))}
          </div>

          {/* Load More Pagination Section (up to 36 cards max) */}
          {visibleCount < maxDisplayable && (
            <div className="mt-12 flex flex-col items-center justify-center space-y-3 pt-6 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                Showing <span className="text-slate-900 font-bold">{displayResults.length}</span> of{' '}
                <span className="text-slate-900 font-bold">{maxDisplayable}</span> restaurants
              </div>

              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-xs hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-tomato/20"
              >
                <span>Show {nextBatchCount} More Restaurant{nextBatchCount === 1 ? '' : 's'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {/* Graceful Finish State when all 36 (or all available) are shown */}
          {visibleCount >= maxDisplayable && maxDisplayable > 0 && (
            <div className="mt-12 text-center py-6 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400">
                Showing all {maxDisplayable} curated spots • Refine cuisine or radius to explore more
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
