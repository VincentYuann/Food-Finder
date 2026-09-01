import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Radio } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';

export function LiveChat({
  messages = [],
  connectionStatus = 'online', // 'connecting' | 'online' | 'offline'
  onSendMessage,
}) {
  const { currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;

    const text = content.trim();
    setContent('');
    setIsSending(true);

    try {
      await onSendMessage(text);
    } catch (err) {
      console.error('Send error:', err);
      // Restore on failure
      setContent(text);
    } finally {
      setIsSending(false);
    }
  };

  const statusConfig = {
    online: { text: 'Live', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    connecting: { text: 'Reconnecting...', dot: 'bg-amber-500 animate-ping', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
    offline: { text: 'Offline (REST)', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 border-slate-200' },
  };

  const currentStatus = statusConfig[connectionStatus] || statusConfig.offline;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft flex flex-col h-[520px] overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-500" />
          <span>Group Discussion</span>
        </h3>

        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${currentStatus.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
          <span>{currentStatus.text}</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fafbfe]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
            <p className="text-xs font-medium">No messages yet.</p>
            <p className="text-[11px] text-slate-400">Say hello and suggest dinner plans!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = currentUser && msg.user_id === currentUser.id;
            const author = msg.user?.username || 'Member';
            const time = msg.sent_at
              ? new Date(msg.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              : '';

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-600">@{author}</span>
                  {time && <span>• {time}</span>}
                </div>
                <div
                  className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                    isMe
                      ? 'bg-brand-500 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Footer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-slate-50"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!content.trim() || isSending}
          icon={Send}
          className="px-3"
        />
      </form>
    </div>
  );
}
