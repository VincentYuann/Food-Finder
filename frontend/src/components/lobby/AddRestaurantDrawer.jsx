import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Search, Bookmark, Plus, Check, Star, Utensils, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { restaurantApi } from '../../api/restaurantApi';
import { lobbyApi } from '../../api/lobbyApi';
import { getImageUrl } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { useSavedRestaurants } from '../../hooks/useRestaurantsQuery';

export function AddRestaurantDrawer({ isOpen, onClose, lobbyId, onRestaurantAdded }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState('search'); // 'search' | 'saved'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // TanStack Query for saved restaurants, enabled when drawer is open on saved tab
  const { data: savedRestaurants = [], isLoading: isLoadingSaved } = useSavedRestaurants({
    enabled: isOpen && tab === 'saved',
  });

  const [addingPlaceId, setAddingPlaceId] = useState(null);
  const [addedPlaceIds, setAddedPlaceIds] = useState(new Set());

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await restaurantApi.searchText(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      console.error(err);
      showToast('Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToLobby = async (placeId, name) => {
    setAddingPlaceId(placeId);
    try {
      await lobbyApi.addRestaurant(lobbyId, placeId);
      setAddedPlaceIds((prev) => new Set([...prev, placeId]));
      showToast(`${name || 'Restaurant'} added to lobby!`, 'success');
      if (onRestaurantAdded) onRestaurantAdded();
    } catch (err) {
      showToast(err.message || 'Failed to add restaurant', 'error');
    } finally {
      setAddingPlaceId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Restaurant to Lobby" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'search'
                ? 'bg-white text-tomato shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
            Search Restaurants
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'saved'
                ? 'bg-white text-tomato shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            From My Saved List
            {savedRestaurants.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                tab === 'saved' ? 'bg-tomato-light text-tomato' : 'bg-slate-200 text-slate-700'
              }`}>
                {savedRestaurants.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Search */}
        {tab === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by restaurant name or cuisine (e.g. Pizza, Ramen)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-white placeholder:text-slate-400"
                />
              </div>
              <Button type="submit" variant="primary" size="md" isLoading={isSearching} className="font-semibold shadow-xs">
                Search
              </Button>
            </form>

            <div className="max-h-88 overflow-y-auto space-y-2.5 pr-1">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-tomato">
                  <LoadingSpinner size="md" />
                  <span className="text-xs text-slate-500 font-medium">Searching restaurants...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {searchQuery ? 'No restaurants found' : 'Search for restaurants'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    {searchQuery
                      ? 'Try searching for another food keyword, cuisine, or specific spot name.'
                      : 'Type a food type (e.g. "Tacos", "Sushi") or restaurant name to find spots.'}
                  </p>
                </div>
              ) : (
                searchResults.map((r) => {
                  const isAdded = addedPlaceIds.has(r.api_place_id);
                  const isAdding = addingPlaceId === r.api_place_id;

                  return (
                    <div
                      key={r.api_place_id}
                      className="p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                          {r.photo_url ? (
                            <img
                              src={getImageUrl(r.photo_url)}
                              alt={r.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Utensils className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-sm font-heading font-bold text-slate-900 truncate">{r.name}</h5>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{r.address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {r.rating && (
                              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {parseFloat(r.rating).toFixed(1)}
                              </div>
                            )}
                            {r.primary_type && (
                              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                                {r.primary_type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isAdded ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Added
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isAdding}
                          isLoading={isAdding}
                          onClick={() => handleAddToLobby(r.api_place_id, r.name)}
                          icon={Plus}
                          className="shrink-0 font-bold shadow-xs"
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Saved */}
        {tab === 'saved' && (
          <div className="max-h-88 overflow-y-auto space-y-2.5 pr-1">
            {isLoadingSaved ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-tomato">
                <LoadingSpinner size="md" />
                <span className="text-xs text-slate-500 font-medium">Loading saved spots...</span>
              </div>
            ) : savedRestaurants.length === 0 ? (
              <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <Bookmark className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No saved spots yet</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Browse restaurants and click "Save" to bookmark favorites here for quick adding.
                </p>
              </div>
            ) : (
              savedRestaurants.map((r) => {
                const isAdded = addedPlaceIds.has(r.api_place_id);
                const isAdding = addingPlaceId === r.api_place_id;

                return (
                  <div
                    key={r.id || r.api_place_id}
                    className="p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                        {r.photo_url ? (
                          <img
                            src={getImageUrl(r.photo_url)}
                            alt={r.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Utensils className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-sm font-heading font-bold text-slate-900 truncate">{r.name}</h5>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{r.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {r.rating && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {parseFloat(r.rating).toFixed(1)}
                            </div>
                          )}
                          {r.primary_type && (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                              {r.primary_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdded ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Added
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isAdding}
                        isLoading={isAdding}
                        onClick={() => handleAddToLobby(r.api_place_id, r.name)}
                        icon={Plus}
                        className="shrink-0 font-bold shadow-xs"
                      >
                        Add
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
