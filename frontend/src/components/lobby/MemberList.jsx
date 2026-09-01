import React, { useState } from 'react';
import { Users, Crown, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';

export function MemberList({
  members = [],
  lobby,
  onToggleReady,
}) {
  const { currentUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const totalMembers = members.length;
  const readyCount = members.filter((m) => m.ready).length;

  const currentMember = members.find((m) => currentUser && m.user?.id === currentUser.id);
  const myReady = currentMember?.ready ?? false;
  const isClosed = lobby?.status === 'closed';
  const isActive = lobby?.status === 'active';

  const handleToggle = async () => {
    if (isClosed || isUpdating) return;
    setIsUpdating(true);
    try {
      await onToggleReady(!myReady);
    } finally {
      setIsUpdating(false);
    }
  };

  const btnLabel = isClosed
    ? 'Lobby Closed'
    : myReady
    ? `Ready (${readyCount}/${totalMembers} ready)`
    : isActive
    ? `I'm Ready to Vote (${readyCount}/${totalMembers})`
    : `Done Voting (${readyCount}/${totalMembers})`;

  const helperText = isClosed
    ? 'This lobby has completed its vote.'
    : isActive
    ? 'When all members are ready, voting unlocks automatically.'
    : 'Mark yourself done once you have selected your top pick.';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <h3 className="font-heading font-semibold text-slate-900 text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-tomato" />
          <span>Members ({totalMembers})</span>
        </h3>
      </div>

      {/* Member List */}
      <ul className="space-y-2 flex-1 overflow-y-auto max-h-60 pr-1">
        {members.map((m) => {
          const user = m.user || {};
          const isHost = user.id === lobby?.created_by;
          const isMe = currentUser && user.id === currentUser.id;

          return (
            <li
              key={m.id || user.id}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                isMe ? 'bg-tomato-light/60 border border-tomato-border' : 'bg-slate-50 border border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                  isMe ? 'bg-tomato text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      @{user.username || 'User'}
                    </span>
                    {isHost && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        <Crown className="w-3 h-3 text-amber-600" /> Host
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <StatusBadge status={m.ready} type="ready" />
            </li>
          );
        })}
      </ul>

      {/* Ready Action Button */}
      <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
        <Button
          variant={isClosed ? 'secondary' : myReady ? 'outline' : 'primary'}
          size="md"
          onClick={handleToggle}
          disabled={isClosed}
          isLoading={isUpdating}
          className="w-full shadow-xs font-heading font-semibold"
        >
          {btnLabel}
        </Button>
        <p className="text-[11px] text-slate-500 text-center leading-tight">
          {helperText}
        </p>
      </div>
    </div>
  );
}
