import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Activity, MapPin } from 'lucide-react';
import Header from './components/Header';
import AlertFeed from './components/AlertFeed';
import CrimeMap from './components/CrimeMap';
import CaseDetails from './components/CaseDetails';
import FiltersBar from './components/FiltersBar';
import StatusStrip from './components/StatusStrip';
import LoginPage from './components/LoginPage';
import { Detection } from './types';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp, updateDoc, writeBatch, deleteField } from "firebase/firestore";
import { db } from "./firebase";

const AUTH_STORAGE_KEY = "wildscan_dashboard_auth";

const App: React.FC = () => {
  const loginEmail = import.meta.env.VITE_LOGIN_EMAIL ?? "";
  const loginPassword = import.meta.env.VITE_LOGIN_PASSWORD ?? "";
  const loginKey = import.meta.env.VITE_LOGIN_KEY ?? "";
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  });
  const [caseDocs, setCaseDocs] = useState<{ id: string; data: any }[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const allPriorities: Detection["priority"][] = ["High", "Medium", "Low"];
  const [severityFilter, setSeverityFilter] = useState<Detection["priority"][]>(allPriorities);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [minConfidence, setMinConfidence] = useState(0);
  const [toastNotifications, setToastNotifications] = useState<{ id: string; caseId: string; title: string; description: string; time: string }[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasRequestedNotifications = useRef(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState<"connecting" | "connected" | "error" | "offline">("connecting");
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [evidenceByCase, setEvidenceByCase] = useState<Record<string, { fileUrl: string; platformSource?: string; aiSummary?: string; evidenceHash?: string }>>({});
  const [caseStatusById, setCaseStatusById] = useState<Record<string, Detection["status"]>>({});
  const [readStateByCase, setReadStateByCase] = useState<Record<string, boolean>>({});

  const normalizePriority = (value?: string): Detection["priority"] => {
    const normalized = value?.toLowerCase();
    if (normalized === "high") return "High";
    if (normalized === "medium") return "Medium";
    if (normalized === "low") return "Low";
    return "Low";
  };

  const normalizeStatus = (value?: string): Detection["status"] | undefined => {
    const normalized = value?.toLowerCase();
    if (normalized === "resolved" || normalized === "successful") return "Resolved";
    if (normalized === "investigating" || normalized === "under investigation") return "Investigating";
    if (normalized === "pending") return "Pending";
    return undefined;
  };

  const resolveLocationName = (data: any) => {
    if (typeof data?.location === "string") return data.location;

    const location = data?.location ?? {};
    const explicitName = location.name || data.location_name || data.locationName;
    if (explicitName) return explicitName as string;

    const parts = [
      location.city,
      location.district,
      location.state,
      location.province,
      location.country,
    ].filter((value) => typeof value === "string" && value.trim().length > 0);

    return parts.length > 0 ? parts.join(", ") : "";
  };

  const buildTrustKey = (data: any) => {
    const species = (data?.speciesDetected || data?.animal_type || data?.caseName || data?.case_name || "").toString().trim().toLowerCase();
    const locationName = resolveLocationName(data).toString().trim().toLowerCase();
    if (!species && !locationName) return "";
    return `${species}||${locationName}`;
  };

  const trustScoreByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    caseDocs.forEach((doc) => {
      const key = buildTrustKey(doc.data);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [caseDocs]);

  const toDetection = (doc: { id: string; data: any }, evidence?: { fileUrl: string; platformSource?: string; aiSummary?: string; evidenceHash?: string }): Detection => {
    const data = doc.data ?? {};
    const location = data.location ?? {};
    const createdAt = data.createdAt ?? data.timestamp ?? data.detectedAt ?? data.updatedAt;
    let timestamp = createdAt;
    if (timestamp && typeof timestamp.toDate === "function") {
      timestamp = timestamp.toDate().toISOString();
    } else if (!timestamp) {
      timestamp = new Date().toISOString();
    }

    const confidence = typeof data.confidenceScore === "number"
      ? data.confidenceScore
      : typeof data.confidence === "number"
        ? data.confidence
        : 0;

    const status = (caseStatusById[doc.id] || normalizeStatus(data.status)) as Detection["status"] | undefined;
    const trustKey = buildTrustKey(data);
    const trustScore = trustKey ? trustScoreByKey[trustKey] || 0 : 0;

    return {
      id: doc.id,
      animal_type: data.speciesDetected || data.animal_type || data.caseName || data.case_name || "",
      case_name: data.caseName || data.case_name || "",
      source: data.source || data.platformSource || evidence?.platformSource || "",
      image_url: evidence?.fileUrl || data.image_url || data.imageUrl || "",
      lat: typeof location.lat === "number" ? location.lat : typeof data.lat === "number" ? data.lat : 0,
      lng: typeof location.lng === "number" ? location.lng : typeof data.lng === "number" ? data.lng : 0,
      timestamp,
      priority: normalizePriority(data.priority),
      confidence,
      location_name: resolveLocationName(data),
      user_handle: data.user_handle,
      post_url: data.post_url,
      description: data.description || data.summary || evidence?.aiSummary || data.status || "",
      status,
      evidence_hash: evidence?.evidenceHash || data.evidenceHash || data.hash || data.sha256,
      trust_score: trustScore,
    };
  };

  // Listen to live data from Firestore
  const CASE_STATUS_COLLECTION = "caseStatus";
  const NOTIFICATION_STATE_COLLECTION = "notificationState";
  const NOTIFICATIONS_COLLECTION = "notifications";

  useEffect(() => {
    if (!isAuthenticated) return () => {};
    let unsubscribe = () => {};
    try {
      if (!db) {
        console.warn("Firestore not available. Falling back to mock data.");
        setFirestoreStatus("offline");
        setFirestoreError("Firestore not available in this environment.");
        return () => {};
      }
      setFirestoreStatus("connecting");
      const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
      unsubscribe = onSnapshot(q, (snapshot: any) => {
        if (snapshot.empty) {
          setCaseDocs([]);
          setFirestoreStatus("connected");
          setFirestoreError(null);
          return;
        }

        const nextDocs = snapshot.docs.map((doc: any) => ({ id: doc.id, data: doc.data() }));
        setCaseDocs(nextDocs);
        setFirestoreStatus("connected");
        setFirestoreError(null);
      }, (error) => {
        console.error("Firestore listening error: ", error);
        setFirestoreStatus("error");
        setFirestoreError(error?.message || "Firestore connection failed.");
      });
    } catch (err) {
      console.warn("Firestore service initialization failed. Ensure API key and permissions are correct.", err);
      setFirestoreStatus("error");
      setFirestoreError("Firestore initialization failed.");
    }
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return () => {};
    if (!db) return () => {};

    const stateRef = collection(db, NOTIFICATION_STATE_COLLECTION);
    const unsubscribe = onSnapshot(stateRef, (snapshot: any) => {
      const next: Record<string, boolean> = {};
      snapshot.docs.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (data?.read) {
          next[docSnap.id] = true;
        }
      });
      setReadStateByCase(next);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return () => {};
    let unsubscribe = () => {};
    if (!db) return () => {};

    const q = query(collection(db, "evidence"), orderBy("uploadedAt", "desc"));
    unsubscribe = onSnapshot(q, (snapshot: any) => {
      if (snapshot.empty) {
        setEvidenceByCase({});
        return;
      }

      const nextMap: Record<string, { fileUrl: string; uploadedAt?: string; platformSource?: string; aiSummary?: string; evidenceHash?: string }> = {};
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const caseId = data.caseId as string | undefined;
        const fileUrl = data.fileUrl as string | undefined;
        const platformSource = data.platformSource as string | undefined;
        const aiSummary = data.aiSummary as string | undefined;
        const evidenceHash = data.evidenceHash || data.hash || data.sha256;
        if (!caseId || !fileUrl) return;
        let uploadedAt = data.uploadedAt;
        if (uploadedAt && typeof uploadedAt.toDate === "function") {
          uploadedAt = uploadedAt.toDate().toISOString();
        }

        if (!nextMap[caseId]) {
          nextMap[caseId] = { fileUrl, uploadedAt, platformSource, aiSummary, evidenceHash };
          return;
        }

        const current = nextMap[caseId];
        if (!current.uploadedAt || (uploadedAt && uploadedAt > current.uploadedAt)) {
          nextMap[caseId] = { fileUrl, uploadedAt, platformSource, aiSummary, evidenceHash };
        }
      });

      setEvidenceByCase(nextMap);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return () => {};
    if (!db) return () => {};

    const statusRef = collection(db, CASE_STATUS_COLLECTION);
    const unsubscribe = onSnapshot(statusRef, (snapshot: any) => {
      const next: Record<string, Detection["status"]> = {};
      snapshot.docs.forEach((docSnap: any) => {
        const data = docSnap.data();
        const status = data?.status as Detection["status"] | undefined;
        if (status) {
          next[docSnap.id] = status;
        }
      });
      setCaseStatusById(next);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    const liveDetections = caseDocs.map((doc) => toDetection(doc, evidenceByCase[doc.id]));
    setDetections(liveDetections);
  }, [caseDocs, evidenceByCase, caseStatusById]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(detections.map((d) => d.source))).sort();
  }, [detections]);

  // Filter detections based on search query and filters
  const filteredDetections = useMemo(() => {
    return detections.filter(d => 
      (d.animal_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.case_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const priorityIconColor: Record<Detection["priority"], string> = {
    High: "text-red-400",
    Medium: "text-amber-400",
    Low: "text-emerald-400",
  };
  const selectedPriorityColor = selectedDetection
    ? priorityIconColor[selectedDetection.priority]
    : "text-slate-500";

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

  const markCasesRead = useCallback((caseIds: string[]) => {
    if (!db || caseIds.length === 0) return;
    const batch = writeBatch(db);
    caseIds.forEach((caseId) => {
      const alreadyRead = readStateByCase[caseId];
      if (alreadyRead) return;
      batch.set(
        doc(db, NOTIFICATION_STATE_COLLECTION, caseId),
        { caseId, read: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      batch.set(
        doc(db, NOTIFICATIONS_COLLECTION, caseId),
        { read: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    });
    batch.commit().catch((error) => {
      console.error("Failed to mark notifications as read:", error);
    });
  }, [db, readStateByCase]);

  const handleOpenNotification = useCallback((caseId: string) => {
    const target = detections.find((d) => d.id === caseId);
    if (target) {
      setSelectedDetection(target);
    }
  }, [detections]);

  const handleNotificationClick = useCallback((caseId: string) => {
    handleOpenNotification(caseId);
    markCasesRead([caseId]);
    setIsNotificationsOpen(false);
  }, [handleOpenNotification, markCasesRead]);

  const handleToggleNotifications = useCallback(() => {
    setIsNotificationsOpen((prev) => !prev);
  }, []);

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

      if (db) {
        const batch = writeBatch(db);
        newCases.forEach((d) => {
          batch.set(
            doc(db, NOTIFICATIONS_COLLECTION, d.id),
            {
              caseId: d.id,
              title: d.animal_type || d.case_name || "Unknown case",
              location: d.location_name || "Unknown location",
              createdAt: serverTimestamp(),
              read: false,
            },
            { merge: true }
          );
        });
        batch.commit().catch((error) => {
          console.error("Failed to create notification records:", error);
        });
      }

      setToastNotifications((prev) => {
        const next = [...created, ...prev];
        return next.slice(0, 3);
      });

      created.forEach((notice) => {
        setTimeout(() => {
          setToastNotifications((prev) => prev.filter((item) => item.id !== notice.id));
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

  useEffect(() => {
    if (detections.length === 0) {
      setHasUnreadNotifications(false);
      return;
    }
    const hasUnread = detections.some((d) => !readStateByCase[d.id]);
    setHasUnreadNotifications(hasUnread);
  }, [detections, readStateByCase]);

  // Sync selection when list changes
  useEffect(() => {
    if (filteredDetections.length > 0) {
      const currentSelectedExists = filteredDetections.find(d => d.id === selectedDetection?.id);
      if (!selectedDetection || !currentSelectedExists) {
        setSelectedDetection(filteredDetections[0]);
      } else {
        setSelectedDetection(currentSelectedExists);
      }
    } else {
      setSelectedDetection(null);
    }
  }, [filteredDetections, selectedDetection?.id]);

  const handleSelectDetection = useCallback((detection: Detection) => {
    setSelectedDetection(detection);
  }, []);

  const handleToggleSeverity = useCallback((level: Detection["priority"]) => {
    setSeverityFilter([level]);
  }, [allPriorities]);

  const handleSelectAllSeverities = useCallback(() => {
    setSeverityFilter(allPriorities);
  }, [allPriorities]);

  const handleResetFilters = useCallback(() => {
    setSeverityFilter(allPriorities);
    setSourceFilter("All");
    setMinConfidence(0);
  }, [allPriorities]);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    }
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const handleStatusChange = useCallback((caseId: string, status: Detection["status"] | undefined) => {
    setCaseStatusById((prev) => {
      if (!status) {
        const { [caseId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [caseId]: status };
    });

    if (!db) return;
    const statusDoc = doc(db, CASE_STATUS_COLLECTION, caseId);
    if (!status) {
      deleteDoc(statusDoc).catch((error) => {
        console.error("Failed to clear case status:", error);
      });

      updateDoc(
        doc(db, "cases", caseId),
        { status: deleteField(), statusDate: deleteField(), updatedAt: serverTimestamp() }
      ).catch((error) => {
        console.error("Failed to reset case status on case:", error);
      });
      return;
    }

    setDoc(
      statusDoc,
      { caseId, status, statusDate: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((error) => {
      console.error("Failed to save case status:", error);
    });

    updateDoc(doc(db, "cases", caseId), { status, statusDate: serverTimestamp(), updatedAt: serverTimestamp() }).catch((error) => {
      console.error("Failed to update case status on case:", error);
    });
  }, []);

  if (!isAuthenticated) {
    return (
      <LoginPage
        expectedEmail={loginEmail}
        expectedPassword={loginPassword}
        expectedKey={loginKey}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const notificationCases = useMemo(() => {
    const sorted = [...detections].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return bTime - aTime;
    });

    return sorted.map((d) => ({
      id: `notice-${d.id}`,
      caseId: d.id,
      title: d.animal_type || d.case_name || "Unknown case",
      description: d.description || "No description provided.",
      time: new Date(d.timestamp).toLocaleString(),
      location: d.location_name || "Unknown location",
      status: d.status || "Pending",
      isRead: !!readStateByCase[d.id],
    }));
  }, [detections, readStateByCase]);

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
            notificationCases={notificationCases}
            isNotificationsOpen={isNotificationsOpen}
            hasUnreadNotifications={hasUnreadNotifications}
            onToggleNotifications={handleToggleNotifications}
            onNotificationClick={handleNotificationClick}
            onLogout={handleLogout}
            firestoreStatus={firestoreStatus}
            firestoreError={firestoreError}
          />

        <FiltersBar
          severityFilter={severityFilter}
          sourceFilter={sourceFilter}
          minConfidence={minConfidence}
          availableSources={availableSources}
          onToggleSeverity={handleToggleSeverity}
          onSelectAllSeverities={handleSelectAllSeverities}
          onSourceChange={setSourceFilter}
          onMinConfidenceChange={setMinConfidence}
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
            {toastNotifications.length > 0 && (
              <div className="absolute top-4 right-6 z-40 space-y-2">
                {toastNotifications.map((notice) => (
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
               />
               
               {/* HUD Overlays */}
               <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
                 <div className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 p-3 rounded-lg shadow-2xl">
                    <h3 className="text-emerald-400 text-[10px] uppercase font-mono mb-2">Location Priority</h3>
                    <div className="flex flex-col gap-2 text-[10px] text-slate-300 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-red-400" />
                          <span>High</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-amber-400" />
                          <span>Medium</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-emerald-400" />
                          <span>Low</span>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Details Sidebar */}
            <aside className="w-96 border-l border-emerald-500/20 bg-slate-900/80 backdrop-blur-md transition-all duration-300 overflow-hidden flex flex-col shadow-2xl">
               <CaseDetails
                 detection={selectedDetection}
                 onStatusChange={handleStatusChange}
               />
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