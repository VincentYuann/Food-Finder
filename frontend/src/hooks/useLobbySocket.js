import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../api/client';
import { authApi } from '../api/authApi';

export function useLobbySocket(lobbyId, {
  onLobbyState,
  onMembers,
  onOptions,
  onVotes,
  onChatMessage,
  onResync,
} = {}) {
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'

  // Stable callbacks using ref to avoid recreating socket listeners on every render
  const callbacksRef = useRef({});
  callbacksRef.current = { onLobbyState, onMembers, onOptions, onVotes, onChatMessage, onResync };

  useEffect(() => {
    if (!lobbyId) return;

    setConnectionStatus('connecting');

    const socket = io(SOCKET_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        authApi
          .getSocketTicket()
          .then((ticket) => cb(ticket ? { ticket } : {}))
          .catch(() => cb({}));
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('lobby:join', lobbyId, (response) => {
        if (!response?.ok) {
          console.error('Could not join lobby room:', response?.error);
          setConnectionStatus('offline');
          return;
        }
        setConnectionStatus('online');
        if (callbacksRef.current.onResync) {
          callbacksRef.current.onResync();
        }
      });
    });

    socket.on('lobby:state', (state) => {
      if (callbacksRef.current.onLobbyState) callbacksRef.current.onLobbyState(state);
    });

    socket.on('lobby:members', (members) => {
      if (callbacksRef.current.onMembers) callbacksRef.current.onMembers(members);
    });

    socket.on('lobby:options', (options) => {
      if (callbacksRef.current.onOptions) callbacksRef.current.onOptions(options);
    });

    socket.on('lobby:votes', (votes) => {
      if (callbacksRef.current.onVotes) callbacksRef.current.onVotes(votes);
    });

    socket.on('chat:message', (message) => {
      if (callbacksRef.current.onChatMessage) callbacksRef.current.onChatMessage(message);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('connecting');
    });

    socket.on('connect_error', (error) => {
      console.warn('Socket connect error:', error.message);
      setConnectionStatus('offline');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [lobbyId]);

  const sendChatMessage = useCallback((content) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || connectionStatus !== 'online') {
        return reject(new Error('Socket offline, fallback needed'));
      }

      socketRef.current
        .timeout(5000)
        .emit('chat:send', { lobbyId, content }, (timeoutError, response) => {
          if (timeoutError) return reject(new Error('Server timed out'));
          if (!response?.ok) return reject(new Error(response?.error || 'Failed to send message'));
          resolve();
        });
    });
  }, [lobbyId, connectionStatus]);

  return {
    connectionStatus,
    isOnline: connectionStatus === 'online',
    sendChatMessage,
  };
}
