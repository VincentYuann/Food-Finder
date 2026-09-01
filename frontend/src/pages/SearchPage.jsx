import React, { useState, useEffect } from 'react';
import { Search, MapPin, Navigation, SlidersHorizontal, Utensils, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { restaurantApi } from '../api/restaurantApi';
import { RestaurantCard } from '../components/restaurants/RestaurantCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useGeolocation } from '../hooks/useGeolocation';
import { useToast } from '../hooks/useToast';

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
  const { showToast } = useToast();
  const { location, isLocating, locationError, requestLocation, clearLocation } = useGeolocation();

  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState('All Cuisines');
  const [radius, setRadius] = useState(5); // miles
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (locationError) {
      showToast(locationError, 'error');
    }
  }, [locationError, showToast]);

  const executeSearch = async (q = query, c = cuisine, r = radius) => {
    setIsLoading(true);
    setHasSearched(true);

    const queryParts = [];
    if (c && c !== 'All Cuisines') queryParts.push(c);
    if (q.trim()) queryParts.push(q.trim());

    const finalQuery = queryParts.join(' ') || 'restaurant';

    try {
      let data = [];
      if (location) {
        data = await restaurantApi.searchNearby({
          latitude: location.latitude,
          longitude: location.longitude,
          radius: String(r),
          keyword: finalQuery,
        });
      } else {
        data = await restaurantApi.searchText(finalQuery);
      }
      setResults(data);
      showToast(`Found ${data.length} restaurants`, 'info');
    } catch (err) {
      console.error('Search error:', err);
      showToast(err.message || 'Search failed', 'error');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    executeSearch(query, cuisine, radius);
  };

  const handleCuisineSelect = (c) => {
    setCuisine(c);
    executeSearch(query, c, radius);
  };

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
  };

  const handleRadiusCommit = (finalRadius) => {
    const r = typeof finalRadius === 'number' ? finalRadius : radius;
    if (location) {
      executeSearch(query, cuisine, r);
    }
  };

  const handlePresetSelect = (newRadius) => {
    setRadius(newRadius);
    if (location) {
      executeSearch(query, cuisine, newRadius);
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setCuisine('All Cuisines');
    setRadius(5);
    executeSearch('', 'All Cuisines', 5);
  };

  // Perform initial search on mount
  useEffect(() => {
    executeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Search Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-ambient space-y-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 tracking-tight">
            Discover Great Places to Eat
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search top-rated spots by name, cuisine, or your live GPS location.
          </p>
        </div>

        {/* Search Controls Form */}
        <form onSubmit={handleSearch} className="space-y-4">
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-white"
              />
            </div>

            {/* Cuisine Dropdown Selector */}
            <div className="sm:col-span-3">
              <select
                value={cuisine}
                onChange={(e) => handleCuisineSelect(e.target.value)}
                aria-label="Filter by cuisine"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-white text-slate-700 font-medium"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Submit */}
            <div className="sm:col-span-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                icon={Search}
                className="w-full shadow-sm hover:shadow-glow-tomato py-2.5"
              >
                Search
              </Button>
            </div>
          </div>

          {/* Quick Cuisine Carousel Strip */}
          <div className="pt-1">
            <div
              role="group"
              aria-label="Cuisine quick filters"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
            >
              {CUISINES.map((c) => {
                const isSelected = cuisine === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCuisineSelect(c)}
                    aria-pressed={isSelected}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-tomato/30 active:scale-95 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & Radius Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {location ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>GPS Location Acquired</span>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="ml-1 text-emerald-600 hover:text-emerald-900"
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
                  <span>Radius: <strong className="text-slate-900 font-semibold">{radius} mi</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={radius}
                    onChange={(e) => handleRadiusChange(Number(e.target.value))}
                    onPointerUp={(e) => handleRadiusCommit(Number(e.target.value))}
                    onKeyUp={(e) => {
                      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
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
                onClick={() => handlePresetSelect(15)}
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
