import React from "react";
import { Flame, Layers, Filter, SlidersHorizontal } from "lucide-react";
import { Detection } from "../types";

interface FiltersBarProps {
  severityFilter: Detection["priority"][];
  sourceFilter: string;
  minConfidence: number;
  availableSources: string[];
  showHeatmap: boolean;
  onToggleSeverity: (level: Detection["priority"]) => void;
  onSelectAllSeverities: () => void;
  onSourceChange: (value: string) => void;
  onMinConfidenceChange: (value: number) => void;
  onToggleHeatmap: () => void;
  onReset: () => void;
}

const severityStyles: Record<Detection["priority"], string> = {
  High: "bg-red-500/10 border-red-500 text-red-400",
  Medium: "bg-amber-500/10 border-amber-500 text-amber-400",
  Low: "bg-emerald-500/10 border-emerald-500 text-emerald-400",
};

const FiltersBar: React.FC<FiltersBarProps> = ({
  severityFilter,
  sourceFilter,
  minConfidence,
  availableSources,
  showHeatmap,
  onToggleSeverity,
  onSelectAllSeverities,
  onSourceChange,
  onMinConfidenceChange,
  onToggleHeatmap,
  onReset,
}) => {
  const isAllSelected = (Object.keys(severityStyles) as Detection["priority"]).every((level) =>
    severityFilter.includes(level)
  );

  return (
    <div className="bg-slate-950/80 border-b border-emerald-500/20 px-6 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono uppercase tracking-widest">
        <Filter size={12} />
        Active Filters
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSelectAllSeverities}
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-all ${
            isAllSelected
              ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600"
          }`}
        >
          All
        </button>
        {(Object.keys(severityStyles) as Detection["priority"][]).map((level) => {
          const isActive = !isAllSelected && severityFilter.includes(level);
          return (
            <button
              key={level}
              onClick={() => onToggleSeverity(level)}
              className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-all ${
                isActive
                  ? severityStyles[level]
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600"
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-mono uppercase">Source</span>
        <select
          value={sourceFilter}
          onChange={(e) => onSourceChange(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="All">All</option>
          {availableSources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <SlidersHorizontal size={12} className="text-emerald-400" />
        <span className="text-[10px] text-slate-500 font-mono uppercase">Min Conf</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(minConfidence * 100)}
          onChange={(e) => onMinConfidenceChange(Number(e.target.value) / 100)}
          className="w-28 accent-emerald-500"
        />
        <span className="text-[10px] text-slate-300 font-mono">{Math.round(minConfidence * 100)}%</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleHeatmap}
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-all ${
            showHeatmap
              ? "bg-indigo-500/10 border-indigo-500 text-indigo-300"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600"
          }`}
        >
          <Layers size={12} className="inline-block mr-1" />
          Heatmap
        </button>
      </div>

      <button
        onClick={onReset}
        className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-slate-800 text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
      >
        <Flame size={12} />
        Reset
      </button>
    </div>
  );
};

export default FiltersBar;
