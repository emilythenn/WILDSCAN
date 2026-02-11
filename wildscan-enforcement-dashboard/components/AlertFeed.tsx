
import React from 'react';
import { Detection } from '../types';
import { AlertCircle, ChevronRight } from 'lucide-react';

interface AlertFeedProps {
  detections: Detection[];
  onSelect: (d: Detection) => void;
  selectedId?: string;
}

const AlertFeed: React.FC<AlertFeedProps> = ({ detections, onSelect, selectedId }) => {
  return (
    <div className="flex overflow-x-auto gap-4 px-6 py-4 scrollbar-hide h-full">
      {detections.length === 0 && (
        <div className="flex items-center justify-center w-full text-slate-500 text-xs font-mono uppercase tracking-widest">
          No detections matching criteria
        </div>
      )}
      {detections.map((detection) => (
        <div 
          key={detection.id}
          onClick={() => onSelect(detection)}
          className={`
            flex-shrink-0 w-64 h-28 rounded-xl border p-3 cursor-pointer transition-all duration-300 relative group overflow-hidden
            ${selectedId === detection.id 
              ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
              : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60'}
          `}
        >
          {/* Scanning Effect for selected item */}
          {selectedId === detection.id && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="h-full w-[2px] bg-emerald-500/50 absolute animate-[scan_2s_linear_infinite]"></div>
            </div>
          )}

          <div className="flex gap-3 h-full">
            <div className="w-20 h-full rounded-lg overflow-hidden relative bg-slate-800">
              <img 
                src={detection.image_url} 
                alt={detection.animal_type} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
              />
              {detection.priority === 'High' && (
                <div className="absolute top-1 left-1 bg-red-600 text-[8px] font-bold px-1 rounded flex items-center gap-0.5">
                  <AlertCircle size={8} />
                  HIGH
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100 truncate">{detection.animal_type}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <span className="opacity-60 uppercase">{detection.source.split(' ')[0]}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="opacity-60">{(detection.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{detection.location_name}</span>
                <ChevronRight size={14} className={`transition-transform ${selectedId === detection.id ? 'translate-x-1 text-emerald-400' : 'text-slate-600'}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes scan {
          from { transform: translateX(0); }
          to { transform: translateX(256px); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AlertFeed;
