import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Search, Bookmark, Plus, Check, Star, Utensils, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { restaurantApi } from '../../api/restaurantApi';
import { lobbyApi } from '../../api/lobbyApi';
import { getImageUrl } from '../../api/client';
import { useToast } from '../../hooks/useToast';

export function AddRestaurantDrawer({ isOpen, onClose, lobbyId, onRestaurantAdded }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState('search'); // 'search' | 'saved'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [savedRestaurants, setSavedRestaurants] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  const [addingPlaceId, setAddingPlaceId] = useState(null);
  const [addedPlaceIds, setAddedPlaceIds] = useState(new Set());

  // Load saved restaurants when tab changes
  useEffect(() => {
    if (isOpen && tab === 'saved') {
      setIsLoadingSaved(true);
      restaurantApi
        .getSavedRestaurants()
        .then((data) => setSavedRestaurants(data))
        .catch((err) => console.error('Failed to load saved:', err))
        .finally(() => setIsLoadingSaved(false));
    }
  }, [isOpen, tab]);

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
                ? 'bg-white text-brand-600 shadow-sm'
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
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            From My Saved List
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-white"
                />
              </div>
              <Button type="submit" variant="primary" size="md" isLoading={isSearching}>
                Search
              </Button>
            </form>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {isSearching ? (
                <div className="py-12 flex justify-center text-brand-500">
                  <LoadingSpinner size="md" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">
                  {searchQuery ? 'No results found. Try a different term.' : 'Enter a query and hit Search.'}
                </p>
              ) : (
                searchResults.map((r) => {
                  const isAdded = addedPlaceIds.has(r.api_place_id);
                  const isAdding = addingPlaceId === r.api_place_id;

                  return (
                    <div
                      key={r.api_place_id}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                          {r.photo_url ? (
                            <img
                              src={getImageUrl(r.photo_url)}
                              alt={r.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Utensils className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-slate-900 truncate">{r.name}</h5>
                          <p className="text-xs text-slate-500 truncate">{r.address}</p>
                          {r.rating && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 mt-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {parseFloat(r.rating).toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant={isAdded ? 'secondary' : 'primary'}
                        size="sm"
                        disabled={isAdded || isAdding}
                        isLoading={isAdding}
                        onClick={() => handleAddToLobby(r.api_place_id, r.name)}
                        icon={isAdded ? Check : Plus}
                        className="shrink-0 font-bold"
                      >
                        {isAdded ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Saved */}
        {tab === 'saved' && (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {isLoadingSaved ? (
              <div className="py-12 flex justify-center text-brand-500">
                <LoadingSpinner size="md" />
              </div>
            ) : savedRestaurants.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                You have not saved any restaurants yet. Search and save spots to see them here.
              </p>
            ) : (
              savedRestaurants.map((r) => {
                const isAdded = addedPlaceIds.has(r.api_place_id);
                const isAdding = addingPlaceId === r.api_place_id;

                return (
                  <div
                    key={r.id || r.api_place_id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {r.photo_url ? (
                          <img
                            src={getImageUrl(r.photo_url)}
                            alt={r.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Utensils className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-slate-900 truncate">{r.name}</h5>
                        <p className="text-xs text-slate-500 truncate">{r.address}</p>
                      </div>
                    </div>

                    <Button
                      variant={isAdded ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={isAdded || isAdding}
                      isLoading={isAdding}
                      onClick={() => handleAddToLobby(r.api_place_id, r.name)}
                      icon={isAdded ? Check : Plus}
                      className="shrink-0 font-bold"
                    >
                      {isAdded ? 'Added' : 'Add'}
                    </Button>
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
