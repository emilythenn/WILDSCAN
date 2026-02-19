
import React, { useState, useRef } from 'react';
import { Shield, Bell, Search, Mic } from 'lucide-react';
import { startSpeechRecognition, stopSpeechRecognition, isSpeechRecognitionSupported } from '../utils/speechUtils';

interface HeaderProps {
  onSearch: (query: string) => void;
  notificationCases: {
    id: string;
    caseId: string;
    title: string;
    description: string;
    time: string;
    location: string;
    status: string;
    isRead: boolean;
  }[];
  isNotificationsOpen: boolean;
  hasUnreadNotifications: boolean;
  onToggleNotifications: () => void;
  onNotificationClick: (caseId: string) => void;
  onLogout: () => void;
  firestoreStatus: "connecting" | "connected" | "error" | "offline";
  firestoreError: string | null;
}

const Header: React.FC<HeaderProps> = ({
  onSearch,
  notificationCases,
  isNotificationsOpen,
  hasUnreadNotifications,
  onToggleNotifications,
  onNotificationClick,
  onLogout,
  firestoreStatus,
  firestoreError,
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [searchInput, setSearchInput] = useState('');

  const handleVoiceSearch = () => {
    if (!isSpeechRecognitionSupported()) {
      alert('Speech Recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      stopSpeechRecognition(recognitionRef.current);
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognitionRef.current = startSpeechRecognition({
      language: 'en-US',
      onResult: (transcript) => {
        setSearchInput(transcript);
        onSearch(transcript);
        setIsListening(false);
      },
      onError: (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };
  const statusStyles: Record<HeaderProps["firestoreStatus"], string> = {
    connected: "bg-emerald-500/10 border-emerald-500 text-emerald-300",
    connecting: "bg-amber-500/10 border-amber-500 text-amber-300",
    error: "bg-red-500/10 border-red-500 text-red-300",
    offline: "bg-slate-500/10 border-slate-500 text-slate-300",
  };

  const statusLabel: Record<HeaderProps["firestoreStatus"], string> = {
    connected: "Live",
    connecting: "Connecting",
    error: "Error",
    offline: "Offline",
  };

  return (
    <header className="h-16 bg-slate-950 border-b border-emerald-500/20 flex items-center justify-between px-6 z-20 shadow-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
            <circle cx="32" cy="32" r="28" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3" />
            <line x1="32" y1="6" x2="32" y2="14" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
            <line x1="32" y1="50" x2="32" y2="58" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
            <line x1="6" y1="32" x2="14" y2="32" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="32" x2="58" y2="32" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
            <path
              d="M18 38c2-6 10-11 18-11 8 0 13 3 16 7-2 1-4 1-6 0-3-2-7-2-11 0l-4 2-2 6-5 2c-4 2-9 1-10-6z"
              fill="#111827"
            />
            <path d="M42 26l8-3" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <line x1="14" y1="50" x2="50" y2="14" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">WILDSCAN</h1>
            <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest leading-none">
              Enforcement Dashboard v2.6.0
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 hidden md:block">
        <div className="relative group flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by species, location, or source..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              onSearch(e.target.value);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-12 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all text-slate-300"
          />
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`absolute right-3 transition-all ${
              isListening 
                ? 'text-emerald-400 animate-pulse' 
                : 'text-slate-500 hover:text-emerald-400'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice search'}
            aria-label={isListening ? 'Stop listening' : 'Start voice search'}
          >
            <Mic size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <span
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest ${statusStyles[firestoreStatus]}`}
          title={firestoreError || `Firestore status: ${statusLabel[firestoreStatus]}`}
        >
          {statusLabel[firestoreStatus]}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleNotifications}
            className="relative cursor-pointer group"
            aria-label="Toggle notifications"
          >
            <Bell className="text-slate-400 group-hover:text-emerald-400 transition-colors" size={20} />
            {hasUnreadNotifications && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-950/95 border border-emerald-500/20 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 text-[10px] uppercase tracking-widest text-emerald-400 font-mono border-b border-slate-800">
                Notifications
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notificationCases.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-slate-500 text-center">No new cases yet.</div>
                ) : (
                  notificationCases.map((notice) => (
                    <button
                      key={notice.id}
                      onClick={() => onNotificationClick(notice.caseId)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-900/70 transition-colors relative ${notice.isRead ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-mono">
                            {notice.title}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                            {notice.location}
                          </div>
                          <div className="mt-2 text-[10px] text-slate-500 font-mono">{notice.time}</div>
                        </div>
                        {!notice.isRead && (
                          <div className="flex-shrink-0 pt-1">
                            <span className="w-2.5 h-2.5 bg-red-500 rounded-full block animate-pulse"></span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-rose-200 hover:border-rose-400 hover:text-rose-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
