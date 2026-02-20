import React, { useState } from "react";
import { Flame, Filter, SlidersHorizontal } from "lucide-react";
import { Detection } from "../types";
import { PREDEFINED_SOURCES, PREDEFINED_LOCATIONS } from "../constants";

interface FiltersBarProps {
  severityFilter: Detection["priority"][];
  sourceFilter: string;
  locationFilter: string;
  minConfidence: number;
  availableSources: string[];
  availableLocations: string[];
  onToggleSeverity: (level: Detection["priority"]) => void;
  onSelectAllSeverities: () => void;
  onSourceChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onMinConfidenceChange: (value: number) => void;
  onReset: () => void;
}

const severityStyles: Record<Detection["priority"], string> = {
  High: "bg-red-500/10 border-red-500 text-red-400",
  Medium: "bg-amber-500/10 border-amber-500 text-amber-400",
  Low: "bg-lime-200/60 border-lime-400 text-lime-700",
};

const FiltersBar: React.FC<FiltersBarProps> = ({
  severityFilter,
  sourceFilter,
  locationFilter,
  minConfidence,
  onToggleSeverity,
  onSelectAllSeverities,
  onSourceChange,
  onLocationChange,
  onMinConfidenceChange,
  onReset,
}) => {
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [customSource, setCustomSource] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [customLocation, setCustomLocation] = useState("");

  const isAllSelected = (Object.keys(severityStyles) as Detection["priority"][]).every((level) =>
    severityFilter.includes(level)
  );

  const handleSourceChange = (value: string) => {
    if (value === "Others") {
      setShowSourceInput(true);
    } else {
      setShowSourceInput(false);
      setCustomSource("");
      onSourceChange(value);
    }
  };

  const handleCustomSourceSubmit = () => {
    if (customSource.trim()) {
      onSourceChange(customSource.trim());
      setShowSourceInput(false);
    }
  };

  const handleLocationChange = (value: string) => {
    if (value === "Others") {
      setShowLocationInput(true);
    } else {
      setShowLocationInput(false);
      setCustomLocation("");
      onLocationChange(value);
    }
  };

  const handleCustomLocationSubmit = () => {
    if (customLocation.trim()) {
      onLocationChange(customLocation.trim());
      setShowLocationInput(false);
    }
  };

  return (
    <div className="bg-white/80 border-b border-lime-400/40 px-6 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-[10px] text-lime-700 font-mono uppercase tracking-widest">
        <Filter size={12} />
        Active Filters
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSelectAllSeverities}
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-all ${
            isAllSelected
              ? "bg-lime-200/60 border-lime-400 text-lime-800"
              : "bg-white border-lime-300 text-green-700 hover:border-lime-400"
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
                  : "bg-white border-lime-300 text-green-700 hover:border-lime-400"
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-green-700 font-mono uppercase">Source</span>
        {!showSourceInput ? (
          <select
            value={sourceFilter}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="bg-white border border-lime-300 text-green-900 text-xs rounded px-2 py-1 focus:outline-none focus:border-lime-400/50"
          >
            <option value="All">All</option>
            {PREDEFINED_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleCustomSourceSubmit();
              }}
              placeholder="Enter source..."
              className="bg-lime-200 border border-lime-400/50 text-green-900 text-xs rounded px-2 py-1 focus:outline-none focus:border-lime-400/80"
              autoFocus
            />
            <button
              onClick={handleCustomSourceSubmit}
              className="px-2 py-1 rounded bg-lime-300/40 border border-lime-400/50 text-lime-700 hover:bg-lime-300/50 text-xs font-mono"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-green-700 font-mono uppercase">Location</span>
        {!showLocationInput ? (
          <select
            value={locationFilter}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="bg-white border border-lime-300 text-green-900 text-xs rounded px-2 py-1 focus:outline-none focus:border-lime-400/50"
          >
            <option value="All">All</option>
            {PREDEFINED_LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleCustomLocationSubmit();
              }}
              placeholder="Enter location..."
              className="bg-lime-200 border border-lime-400/50 text-green-900 text-xs rounded px-2 py-1 focus:outline-none focus:border-lime-400/80"
              autoFocus
            />
            <button
              onClick={handleCustomLocationSubmit}
              className="px-2 py-1 rounded bg-lime-300/40 border border-lime-400/50 text-lime-700 hover:bg-lime-300/50 text-xs font-mono"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SlidersHorizontal size={12} className="text-lime-700" />
        <span className="text-[10px] text-green-700 font-mono uppercase">Min Conf</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(minConfidence * 100)}
          onChange={(e) => onMinConfidenceChange(Number(e.target.value) / 100)}
          className="w-28 accent-lime-600"
        />
        <span className="text-[10px] text-green-900 font-mono">{Math.round(minConfidence * 100)}%</span>
      </div>

      <button
        onClick={onReset}
        className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-lime-300 text-[10px] font-mono uppercase tracking-widest text-green-800 hover:border-lime-500/60 hover:text-lime-700 transition-colors"
      >
        <Flame size={12} />
        Reset
      </button>
    </div>
  );
};

export default FiltersBar;
