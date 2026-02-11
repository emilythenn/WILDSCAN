import React from "react";
import { Activity, ShieldAlert, TrendingUp, Clock } from "lucide-react";

interface StatusStripProps {
  total: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgConfidence: number;
  lastUpdated: string;
  activitySeries: number[];
}

const StatusStrip: React.FC<StatusStripProps> = ({
  total,
  highCount,
  mediumCount,
  lowCount,
  avgConfidence,
  lastUpdated,
  activitySeries,
}) => {
  const maxActivity = Math.max(1, ...activitySeries);

  return (
    <div className="bg-slate-950/70 border-b border-emerald-500/10 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
          Total Cases
          <Activity size={12} className="text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-slate-100 mt-1">{total}</div>
        <div className="text-[10px] text-slate-500 mt-1">
          High {highCount} • Med {mediumCount} • Low {lowCount}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
          Avg Confidence
          <TrendingUp size={12} className="text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-slate-100 mt-1">{Math.round(avgConfidence * 100)}%</div>
        <div className="mt-2 flex items-end gap-1 h-6">
          {activitySeries.map((value, index) => (
            <span
              key={index}
              className="w-2 rounded bg-emerald-500/60"
              style={{ height: `${Math.max(3, (value / maxActivity) * 24)}px` }}
            />
          ))}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
          Priority Focus
          <ShieldAlert size={12} className="text-red-400" />
        </div>
        <div className="text-2xl font-bold text-slate-100 mt-1">{highCount}</div>
        <div className="text-[10px] text-slate-500 mt-1">High priority open alerts</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
          Last Update
          <Clock size={12} className="text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-slate-100 mt-1">{lastUpdated}</div>
        <div className="text-[10px] text-slate-500 mt-1">Live feed sync</div>
      </div>
    </div>
  );
};

export default StatusStrip;
