
import React from 'react';
import { Shield, Bell, Search } from 'lucide-react';

interface HeaderProps {
  onSearch: (query: string) => void;
  notifications: { id: string; caseId: string; title: string; description: string; time: string }[];
  isNotificationsOpen: boolean;
  onToggleNotifications: () => void;
  onNotificationClick: (caseId: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  onSearch,
  notifications,
  isNotificationsOpen,
  onToggleNotifications,
  onNotificationClick,
}) => {
  return (
    <header className="h-16 bg-slate-950 border-b border-emerald-500/20 flex items-center justify-between px-6 z-20 shadow-lg">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <Shield className="text-slate-950" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            WILD<span className="text-emerald-500">SCAN</span>
          </h1>
          <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest leading-none">
            Enforcement Dashboard v2.6.0
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 hidden md:block">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by species, location, or source..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all text-slate-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleNotifications}
            className="relative cursor-pointer group"
            aria-label="Toggle notifications"
          >
            <Bell className="text-slate-400 group-hover:text-emerald-400 transition-colors" size={20} />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-950/95 border border-emerald-500/20 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 text-[10px] uppercase tracking-widest text-emerald-400 font-mono border-b border-slate-800">
                Notifications
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-slate-500 text-center">No new cases yet.</div>
                ) : (
                  notifications.map((notice) => (
                    <button
                      key={notice.id}
                      onClick={() => onNotificationClick(notice.caseId)}
                      className="w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-900/70 transition-colors"
                    >
                      <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-mono">
                        {notice.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-200 line-clamp-3">
                        {notice.description}
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">{notice.time}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-200">Insp. Rahman</p>
            <p className="text-[10px] text-emerald-500 font-mono">Wildlife Authority Unit 4</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden group-hover:border-emerald-500 transition-colors">
            <img src="https://picsum.photos/seed/inspector/100/100" alt="avatar" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
