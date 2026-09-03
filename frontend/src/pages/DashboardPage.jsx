import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useModal } from '../hooks/useModal';
import { authApi } from '../api/authApi';
import { lobbyApi } from '../api/lobbyApi';
import { restaurantApi } from '../api/restaurantApi';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { SavedRestaurantItem } from '../components/restaurants/SavedRestaurantItem';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  Users,
  PlusCircle,
  LogIn,
  Bookmark,
  ExternalLink,
  Trash2,
  XCircle,
  Utensils,
  Share2,
} from 'lucide-react';

export function DashboardPage() {
  const { currentUser, removeSavedPlaceId } = useAuth();
  const { showToast } = useToast();
  const { confirmModal } = useModal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Create / Join state
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Lists state
  const [lobbies, setLobbies] = useState([]);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(true);

  const [savedRestaurants, setSavedRestaurants] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  const autoJoinAttemptedRef = useRef(false);

  // Check URL params for invite code and auto-join
  useEffect(() => {
    const code = searchParams.get('join') || searchParams.get('code');
    if (code && !autoJoinAttemptedRef.current) {
      const cleanCode = code.trim().toUpperCase();
      setJoinCode(cleanCode);
      autoJoinAttemptedRef.current = true;

      (async () => {
        setIsJoining(true);
        try {
          const lobby = await lobbyApi.joinLobby(cleanCode);
          showToast(`Successfully joined "${lobby.name || 'lobby'}"!`, 'success');
          navigate(`/lobby/${lobby.id}`, { replace: true });
        } catch (err) {
          showToast(err.message || 'Could not auto-join lobby. Please check the code.', 'error');
        } finally {
          setIsJoining(false);
        }
      })();
    }
  }, [searchParams, navigate, showToast]);

  const loadLobbies = useCallback(async () => {
    setIsLoadingLobbies(true);
    try {
      const memberships = await authApi.getUserLobbies();
      setLobbies(memberships.map((m) => m.lobby).filter(Boolean));
    } catch (err) {
      console.error(err);
      showToast('Failed to load your lobbies', 'error');
    } finally {
      setIsLoadingLobbies(false);
    }
  }, [showToast]);

  const loadSaved = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const saved = await restaurantApi.getSavedRestaurants();
      setSavedRestaurants(saved);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    loadLobbies();
    loadSaved();
  }, [loadLobbies, loadSaved]);

  const handleCreateLobby = async (e) => {
    e.preventDefault();
    if (!createName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newLobby = await lobbyApi.createLobby(createName.trim());
      showToast(`Lobby "${newLobby.name}" created!`, 'success');
      navigate(`/lobby/${newLobby.id}`);
    } catch (err) {
      showToast(err.message || 'Could not create lobby', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async (e) => {
    e.preventDefault();
    if (!joinCode.trim() || isJoining) return;

    setIsJoining(true);
    try {
      const lobby = await lobbyApi.joinLobby(joinCode.trim().toUpperCase());
      showToast(`Joined ${lobby.name || 'lobby'}!`, 'success');
      navigate(`/lobby/${lobby.id}`);
    } catch (err) {
      showToast(err.message || 'Could not join lobby. Check your code.', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLobbyAction = async (action, lobby) => {
    const isHost = currentUser && lobby.created_by === currentUser.id;
    const name = lobby.name || 'Untitled Lobby';

    if (action === 'close') {
      const confirmed = await confirmModal({
        title: 'Close Lobby',
        message: `Close "${name}"? Everyone will still see it, but suggestions will be locked.`,
        confirmText: 'Close Lobby',
        confirmVariant: 'warning',
      });
      if (!confirmed) return;

      try {
        await lobbyApi.updateLobbyStatus(lobby.id, 'closed');
        showToast(`Lobby closed.`, 'info');
        loadLobbies();
      } catch (err) {
        showToast(err.message || 'Failed to close lobby', 'error');
      }
    } else if (action === 'delete') {
      const confirmed = await confirmModal({
        title: 'Delete Lobby',
        message: `Permanently delete "${name}"? This removes it for every member and cannot be undone.`,
        confirmText: 'Delete Permanently',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;

      try {
        await lobbyApi.deleteLobby(lobby.id);
        showToast(`Lobby deleted.`, 'info');
        loadLobbies();
      } catch (err) {
        showToast(err.message || 'Failed to delete lobby', 'error');
      }
    } else if (action === 'leave') {
      const confirmed = await confirmModal({
        title: 'Leave Lobby',
        message: `Remove "${name}" from your active lobbies?`,
        confirmText: 'Leave',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;

      try {
        await lobbyApi.leaveLobby(lobby.id, currentUser.id);
        showToast(`Left lobby.`, 'info');
        loadLobbies();
      } catch (err) {
        showToast(err.message || 'Failed to leave lobby', 'error');
      }
    }
  };

  const handleUnsave = async (restaurantId, placeId) => {
    await restaurantApi.unsaveRestaurant(restaurantId);
    removeSavedPlaceId(placeId);
    setSavedRestaurants((prev) => prev.filter((r) => r.id !== restaurantId));
    showToast('Removed from saved list', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-ambient flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 tracking-tight">
            Welcome back, {currentUser?.username}!
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create a voting group, browse saved spots, or jump back into an active lobby.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/search')}
            icon={Utensils}
            className="shadow-sm hover:shadow-glow-tomato"
          >
            Find Restaurants
          </Button>
        </div>
      </div>

      {/* Action Cards: Create & Join */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Lobby Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-ambient flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-tomato-light text-tomato flex items-center justify-center mb-3">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-heading font-semibold text-slate-900">Start a Group Lobby</h3>
            <p className="text-xs text-slate-500 mt-1">
              Create a real-time room to invite friends, shortlist dishes, and vote on where to eat.
            </p>
          </div>

          <form onSubmit={handleCreateLobby} className="mt-5 flex gap-2">
            <input
              type="text"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Friday Night Dinner"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-white"
            />
            <Button type="submit" variant="primary" size="md" isLoading={isCreating}>
              Create
            </Button>
          </form>
        </div>

        {/* Join Lobby Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-ambient flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
              <LogIn className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-heading font-semibold text-slate-900">Join with Code</h3>
            <p className="text-xs text-slate-500 mt-1">
              Have an invite code from a friend? Enter it below to jump directly into the lobby.
            </p>
          </div>

          <form onSubmit={handleJoinLobby} className="mt-5 flex gap-2">
            <input
              type="text"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. DINNER123"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-tomato/20 focus:border-tomato bg-white"
            />
            <Button type="submit" variant="outline" size="md" isLoading={isJoining}>
              Join
            </Button>
          </form>
        </div>
      </div>

      {/* Main Content Grid: Lobbies & Saved Restaurants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: My Lobbies */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-tomato" />
              <span>My Group Lobbies</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {lobbies.length} {lobbies.length === 1 ? 'lobby' : 'lobbies'}
            </span>
          </div>

          {isLoadingLobbies ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center text-tomato">
              <LoadingSpinner size="lg" />
            </div>
          ) : lobbies.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-heading font-semibold text-slate-700 text-sm">No lobbies joined yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create a lobby or join an existing one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lobbies.map((lobby) => {
                const isHost = currentUser && lobby.created_by === currentUser.id;
                const isClosed = lobby.status === 'closed';

                return (
                  <div
                    key={lobby.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-ambient hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-heading font-semibold text-slate-900 text-base leading-snug">
                          {lobby.name || 'Untitled Lobby'}
                        </h4>
                        <StatusBadge status={lobby.status} />
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        {lobby.invite_code && (
                          <span>
                            Code: <strong className="text-tomato font-mono font-bold tracking-wider">{lobby.invite_code}</strong>
                          </span>
                        )}
                        <span className="text-slate-300">/</span>
                        <span>{isHost ? 'Created by you (Host)' : 'Member'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/lobby/${lobby.id}`)}
                        icon={ExternalLink}
                      >
                        View Lobby
                      </Button>

                      {isHost && !isClosed && (
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleLobbyAction('close', lobby)}
                        >
                          Close
                        </Button>
                      )}

                      {isClosed && isHost && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleLobbyAction('delete', lobby)}
                          icon={Trash2}
                        >
                          Delete
                        </Button>
                      )}

                      {isClosed && !isHost && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleLobbyAction('leave', lobby)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Saved Restaurants */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-semibold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-tomato" />
              <span>Saved Places</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {savedRestaurants.length} saved
            </span>
          </div>

          {isLoadingSaved ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 flex justify-center text-brand-500">
              <LoadingSpinner size="md" />
            </div>
          ) : savedRestaurants.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-xs">No saved places yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Save spots while searching to quickly add them to future lobbies.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {savedRestaurants.map((restaurant) => (
                <SavedRestaurantItem
                  key={restaurant.id}
                  restaurant={restaurant}
                  onUnsave={handleUnsave}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
