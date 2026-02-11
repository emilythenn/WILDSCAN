import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Activity } from 'lucide-react';
import Header from './components/Header';
import AlertFeed from './components/AlertFeed';
import CrimeMap from './components/CrimeMap';
import CaseDetails from './components/CaseDetails';
import FiltersBar from './components/FiltersBar';
import StatusStrip from './components/StatusStrip';
import { Detection } from './types';
import { mockDetections } from './constants';
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";

const App: React.FC = () => {
  const [detections, setDetections] = useState<Detection[]>(mockDetections);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Detection["priority"][]>([
    "High",
    "Medium",
    "Low",
  ]);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [minConfidence, setMinConfidence] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; caseId: string; title: string; description: string; time: string }[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasRequestedNotifications = useRef(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Listen to live data from Firestore
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      if (!db) {
        console.warn("Firestore not available. Falling back to mock data.");
        return () => {};
      }
      const q = query(collection(db, "detected_posts"), orderBy("timestamp", "desc"));
      unsubscribe = onSnapshot(q, (snapshot: any) => {
        if (!snapshot.empty) {
          const liveDetections = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            let timestamp = data.timestamp;
            if (timestamp && typeof timestamp.toDate === "function") {
              timestamp = timestamp.toDate().toISOString();
            } else if (!timestamp) {
              timestamp = new Date().toISOString();
            }
            return { id: doc.id, ...data, timestamp } as Detection;
          });
          setDetections(liveDetections);
        }
      }, (error) => {
        console.error("Firestore listening error: ", error);
      });
    } catch (err) {
      console.warn("Firestore service initialization failed. Ensure API key and permissions are correct.", err);
    }
    return () => unsubscribe();
  }, []);

  const availableSources = useMemo(() => {
    return Array.from(new Set(detections.map((d) => d.source))).sort();
  }, [detections]);

  // Filter detections based on search query and filters
  const filteredDetections = useMemo(() => {
    return detections.filter(d => 
      (d.animal_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.id?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      severityFilter.includes(d.priority) &&
      (sourceFilter === "All" || d.source === sourceFilter) &&
      d.confidence >= minConfidence
    );
  }, [detections, minConfidence, searchQuery, severityFilter, sourceFilter]);

  const stats = useMemo(() => {
    const total = filteredDetections.length;
    const highCount = filteredDetections.filter((d) => d.priority === "High").length;
    const mediumCount = filteredDetections.filter((d) => d.priority === "Medium").length;
    const lowCount = filteredDetections.filter((d) => d.priority === "Low").length;
    const avgConfidence = total > 0
      ? filteredDetections.reduce((sum, d) => sum + d.confidence, 0) / total
      : 0;

    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const buckets = Array.from({ length: 7 }, () => 0);
    filteredDetections.forEach((d) => {
      const time = new Date(d.timestamp).getTime();
      const diff = now - time;
      if (Number.isFinite(time) && diff >= 0 && diff <= hourMs * 7) {
        const index = Math.min(6, Math.floor(diff / hourMs));
        buckets[6 - index] += 1;
      }
    });

    const latestTimestamp = filteredDetections
      .map((d) => new Date(d.timestamp).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => b - a)[0];

    return {
      total,
      highCount,
      mediumCount,
      lowCount,
      avgConfidence,
      activitySeries: buckets,
      lastUpdated: latestTimestamp ? new Date(latestTimestamp).toLocaleTimeString() : "N/A",
    };
  }, [filteredDetections]);

  const showSystemNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      const notice = new Notification(title, { body });
      if (onClick) {
        notice.onclick = () => onClick();
      }
      return;
    }

    if (Notification.permission !== "denied" && !hasRequestedNotifications.current) {
      hasRequestedNotifications.current = true;
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          const notice = new Notification(title, { body });
          if (onClick) {
            notice.onclick = () => onClick();
          }
        }
      });
    }
  }, []);

  const handleOpenNotification = useCallback((caseId: string) => {
    const target = detections.find((d) => d.id === caseId);
    if (target) {
      setSelectedDetection(target);
    }
  }, [detections]);

  const handleNotificationClick = useCallback((caseId: string) => {
    handleOpenNotification(caseId);
    setIsNotificationsOpen(false);
  }, [handleOpenNotification]);

  useEffect(() => {
    if (detections.length === 0) return;
    const knownIds = knownIdsRef.current;
    const newCases = detections.filter((d) => !knownIds.has(d.id));
    if (knownIds.size === 0) {
      detections.forEach((d) => knownIds.add(d.id));
      return;
    }

    if (newCases.length > 0) {
      newCases.forEach((d) => knownIds.add(d.id));
      const created = newCases.map((d, index) => ({
        id: `case-${d.id}-${Date.now()}-${index}`,
        caseId: d.id,
        title: d.animal_type,
        description: d.description || "No description provided.",
        time: new Date().toLocaleTimeString(),
      }));

      setNotifications((prev) => {
        const next = [...created, ...prev];
        return next.slice(0, 3);
      });

      created.forEach((notice) => {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((item) => item.id !== notice.id));
        }, 6000);
      });

      newCases.forEach((d) => {
        showSystemNotification(
          d.animal_type,
          d.description || "No description provided.",
          () => handleOpenNotification(d.id)
        );
      });
    }
  }, [detections, handleOpenNotification, showSystemNotification]);

  // Sync selection when list changes
  useEffect(() => {
    if (filteredDetections.length > 0) {
      const currentSelectedExists = filteredDetections.find(d => d.id === selectedDetection?.id);
      if (!selectedDetection || !currentSelectedExists) {
        setSelectedDetection(filteredDetections[0]);
      }
    } else {
      setSelectedDetection(null);
    }
  }, [filteredDetections, selectedDetection?.id]);

  const handleSelectDetection = useCallback((detection: Detection) => {
    setSelectedDetection(detection);
  }, []);

  const handleToggleSeverity = useCallback((level: Detection["priority"]) => {
    setSeverityFilter((prev) => {
      const isActive = prev.includes(level);
      if (isActive && prev.length === 1) {
        return prev;
      }
      return isActive ? prev.filter((item) => item !== level) : [...prev, level];
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSeverityFilter(["High", "Medium", "Low"]);
    setSourceFilter("All");
    setMinConfidence(0);
    setShowHeatmap(false);
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 overflow-y-auto font-sans"
      dir="rtl"
    >
      <div className="flex min-h-screen" dir="ltr">
        {/* Global Scanning Line Animation */}
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20 z-50 overflow-hidden">
          <div className="h-full bg-emerald-500 w-1/3 animate-[loading_3s_infinite]"></div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden relative">
          <Header
            onSearch={setSearchQuery}
            notifications={notifications}
            isNotificationsOpen={isNotificationsOpen}
            onToggleNotifications={() => setIsNotificationsOpen((prev) => !prev)}
            onNotificationClick={handleNotificationClick}
          />

        <FiltersBar
          severityFilter={severityFilter}
          sourceFilter={sourceFilter}
          minConfidence={minConfidence}
          availableSources={availableSources}
          showHeatmap={showHeatmap}
          onToggleSeverity={handleToggleSeverity}
          onSourceChange={setSourceFilter}
          onMinConfidenceChange={setMinConfidence}
          onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
          onReset={handleResetFilters}
        />

        <StatusStrip
          total={stats.total}
          highCount={stats.highCount}
          mediumCount={stats.mediumCount}
          lowCount={stats.lowCount}
          avgConfidence={stats.avgConfidence}
          lastUpdated={stats.lastUpdated}
          activitySeries={stats.activitySeries}
        />

          <main className="flex flex-1 overflow-hidden relative">
            {notifications.length > 0 && (
              <div className="absolute top-4 right-6 z-40 space-y-2">
                {notifications.map((notice) => (
                  <button
                    key={notice.id}
                    onClick={() => handleOpenNotification(notice.caseId)}
                    className="bg-slate-950/90 border border-emerald-500/30 shadow-xl rounded-lg px-4 py-3 text-left text-xs text-slate-200 w-72 hover:border-emerald-500/60 hover:bg-slate-900/90 transition-colors"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono">{notice.title}</div>
                    <div className="mt-1 text-slate-100 line-clamp-3">{notice.description}</div>
                    <div className="mt-1 text-[10px] text-slate-500 font-mono">{notice.time}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col flex-1 overflow-hidden">
            {/* Live Feed Header Area */}
            <div className="h-48 border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-sm z-10">
              <div className="px-6 py-2 flex justify-between items-center bg-slate-950/50 border-b border-emerald-500/10">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-widest">
                  <Activity size={14} className="animate-pulse" />
                  <span>Live Detection Stream ({filteredDetections.length})</span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-tighter">
                  Status: Secure Monitoring Active
                </div>
              </div>
              <AlertFeed 
                detections={filteredDetections} 
                onSelect={handleSelectDetection} 
                selectedId={selectedDetection?.id} 
              />
            </div>

            {/* Map Area */}
            <div className="flex-1 relative bg-slate-900">
               <CrimeMap 
                detections={filteredDetections} 
                selectedDetection={selectedDetection}
                onMarkerClick={handleSelectDetection}
                showHeatmap={showHeatmap}
               />
               
               {/* HUD Overlays */}
               <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
                 <div className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 p-3 rounded-lg shadow-2xl">
                    <h3 className="text-emerald-400 text-[10px] uppercase font-mono mb-2">System Telemetry</h3>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] text-slate-300 font-mono">DB_LINK: ESTABLISHED</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] text-slate-300 font-mono">GEO_LOCK: STABLE</span>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Details Sidebar */}
            <aside className="w-96 border-l border-emerald-500/20 bg-slate-900/80 backdrop-blur-md transition-all duration-300 overflow-hidden flex flex-col shadow-2xl">
               <CaseDetails detection={selectedDetection} />
            </aside>
          </main>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default App;