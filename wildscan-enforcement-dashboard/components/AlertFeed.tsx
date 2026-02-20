
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
        <div className="flex items-center justify-center w-full text-green-700 text-xs font-mono uppercase tracking-widest">
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
              ? 'bg-lime-200/60 border-lime-400 shadow-[0_0_20px_rgba(132,204,22,0.16)]' 
              : 'bg-lime-200/60 border-lime-300 hover:border-lime-400 hover:bg-lime-200/70'}
          `}
        >

          <div className="flex gap-3 h-full">
            <div className="w-20 h-full rounded-lg overflow-hidden relative bg-lime-200">
              {detection.image_url ? (
                <img 
                  src={detection.image_url} 
                  alt={detection.animal_type} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] text-green-700 font-mono">
                  No Image
                </div>
              )}
              {detection.priority === 'High' && (
                <div className="absolute top-1 left-1 bg-red-600 text-[8px] font-bold px-1 rounded flex items-center gap-0.5">
                  <AlertCircle size={8} />
                  HIGH
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-green-950 truncate">{detection.animal_type}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-lime-700 font-mono">
                  <span className="opacity-60 uppercase">{detection.source.split(' ')[0]}</span>
                  <span className="w-1 h-1 rounded-full bg-lime-400"></span>
                  <span className="opacity-60">{(detection.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-green-700 truncate max-w-[80px]">{detection.location_name}</span>
                <ChevronRight size={14} className={`transition-transform ${selectedId === detection.id ? 'translate-x-1 text-lime-700' : 'text-green-800'}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
      <style>{`
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
