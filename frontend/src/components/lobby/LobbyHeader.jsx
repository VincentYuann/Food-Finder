import React, { useState } from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { Copy, Check, User, Share2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export function LobbyHeader({ lobby }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const inviteCode = lobby?.invite_code || '';

  const handleCopy = async () => {
    if (!inviteCode) return;
    const joinUrl = `${window.location.origin}/?join=${encodeURIComponent(inviteCode)}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = joinUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy invite code', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {lobby?.name || 'Untitled Lobby'}
            </h1>
            <StatusBadge status={lobby?.status} />
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs sm:text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <span>Created by <strong className="text-slate-800">@{lobby?.creator?.username || 'user'}</strong></span>
            </div>

            {inviteCode && (
              <div className="flex items-center gap-2">
                <span>Invite Code:</span>
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 font-mono font-bold text-xs tracking-wider">
                  {inviteCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  title="Copy invite link"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
