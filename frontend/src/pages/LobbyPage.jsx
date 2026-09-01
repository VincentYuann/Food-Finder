import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lobbyApi } from '../api/lobbyApi';
import { useLobbySocket } from '../hooks/useLobbySocket';
import { useToast } from '../hooks/useToast';
import { LobbyHeader } from '../components/lobby/LobbyHeader';
import { MemberList } from '../components/lobby/MemberList';
import { RestaurantShortlist } from '../components/lobby/RestaurantShortlist';
import { WinnerSpotlight } from '../components/lobby/WinnerSpotlight';
import { AddRestaurantDrawer } from '../components/lobby/AddRestaurantDrawer';
import { LiveChat } from '../components/lobby/LiveChat';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Plus, Utensils, AlertTriangle } from 'lucide-react';

const PHASE_ANNOUNCEMENTS = {
  voting: 'Everyone is ready - voting has started!',
  closed: 'The lobby is closed. The votes are in!',
  active: 'The lobby is open for suggestions again.',
};

export function LobbyPage() {
  const { id: lobbyId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [lobby, setLobby] = useState(null);
  const [members, setMembers] = useState([]);
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const prevStatusRef = useRef(null);

  // Full fetch of lobby data (used on initial load and reconnect)
  const resyncLobby = useCallback(async () => {
    if (!lobbyId) return;

    try {
      const [lobbyData, membersData, optionsData, votesData, messagesData] =
        await Promise.all([
          lobbyApi.getLobby(lobbyId),
          lobbyApi.getMembers(lobbyId),
          lobbyApi.getRestaurants(lobbyId),
          lobbyApi.getVotes(lobbyId),
          lobbyApi.getMessages(lobbyId),
        ]);

      setLobby(lobbyData);
      setMembers(membersData);
      setOptions(optionsData);
      setVotes(votesData);
      setMessages(messagesData);

      // Check phase transition
      if (prevStatusRef.current && lobbyData.status !== prevStatusRef.current) {
        const msg = PHASE_ANNOUNCEMENTS[lobbyData.status];
        if (msg) showToast(msg, 'success');
      }
      prevStatusRef.current = lobbyData.status;
    } catch (err) {
      console.error('Failed to sync lobby:', err);
      showToast(err.message || 'Lobby inaccessible', 'error');
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }, [lobbyId, navigate, showToast]);

  useEffect(() => {
    resyncLobby();
  }, [resyncLobby]);

  // Socket handlers
  const handleLobbyState = useCallback((state) => {
    setLobby((prev) => {
      if (prev && state.status !== prev.status) {
        const msg = PHASE_ANNOUNCEMENTS[state.status];
        if (msg) showToast(msg, 'success');
      }
      prevStatusRef.current = state.status;
      return state;
    });
    if (state.members) setMembers(state.members);
  }, [showToast]);

  const handleMembers = useCallback((newMembers) => {
    setMembers(newMembers);
  }, []);

  const handleOptions = useCallback((newOptions) => {
    setOptions(newOptions);
  }, []);

  const handleVotes = useCallback((newVotes) => {
    setVotes(newVotes);
  }, []);

  const handleChatMessage = useCallback((newMsg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  }, []);

  const { connectionStatus, sendChatMessage } = useLobbySocket(lobbyId, {
    onLobbyState: handleLobbyState,
    onMembers: handleMembers,
    onOptions: handleOptions,
    onVotes: handleVotes,
    onChatMessage: handleChatMessage,
    onResync: resyncLobby,
  });

  // User Actions
  const handleToggleReady = async (ready) => {
    await lobbyApi.setReady(lobbyId, ready);
    await resyncLobby();
  };

  const handleVote = async (restaurantId) => {
    await lobbyApi.castVote(lobbyId, restaurantId);
    const updatedVotes = await lobbyApi.getVotes(lobbyId);
    setVotes(updatedVotes);
  };

  const handleRemoveRestaurant = async (restaurantId) => {
    await lobbyApi.removeRestaurant(lobbyId, restaurantId);
    setOptions((prev) => prev.filter((opt) => opt.restaurant.id !== restaurantId));
  };

  const handleSendMessage = async (content) => {
    try {
      await sendChatMessage(content);
    } catch {
      // Fallback to REST
      const savedMsg = await lobbyApi.sendMessage(lobbyId, content);
      setMessages((prev) => [...prev, savedMsg]);
    }
  };

  // Determine winning restaurant if lobby is closed
  let winningOption = null;
  let maxVotes = -1;
  const isClosed = lobby?.status === 'closed';

  if (isClosed && options.length > 0) {
    options.forEach((opt) => {
      const count = votes.filter((v) => v.restaurant_id === opt.restaurant.id).length;
      if (count > maxVotes) {
        maxVotes = count;
        winningOption = opt;
      }
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-3 text-brand-500">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading lobby room...</p>
      </div>
    );
  }

  if (!lobby) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <LobbyHeader lobby={lobby} />

      {/* Winner Spotlight Banner (when closed) */}
      {isClosed && winningOption && (
        <WinnerSpotlight winningOption={winningOption} voteCount={maxVotes} />
      )}

      {/* Main Grid: Shortlist on Left / Members & Chat on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Shortlist */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-brand-500" />
              <span>Restaurant Shortlist ({options.length})</span>
            </h2>

            {lobby.status === 'active' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddDrawerOpen(true)}
                icon={Plus}
                className="font-bold shadow-md shadow-brand-500/20"
              >
                Add to Lobby
              </Button>
            )}
          </div>

          <RestaurantShortlist
            options={options}
            votes={votes}
            members={members}
            lobby={lobby}
            onVote={handleVote}
            onRemove={handleRemoveRestaurant}
            isWinnerId={winningOption?.restaurant?.id}
          />
        </div>

        {/* Right 1 Col: Members & Live Chat */}
        <div className="space-y-6">
          <MemberList
            members={members}
            lobby={lobby}
            onToggleReady={handleToggleReady}
          />

          <LiveChat
            messages={messages}
            connectionStatus={connectionStatus}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {/* Add Restaurant Drawer / Modal */}
      <AddRestaurantDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        lobbyId={lobbyId}
        onRestaurantAdded={resyncLobby}
      />
    </div>
  );
}
