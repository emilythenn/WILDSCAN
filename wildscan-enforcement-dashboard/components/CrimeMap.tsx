
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Detection } from '../types';

interface CrimeMapProps {
  detections: Detection[];
  selectedDetection: Detection | null;
  onMarkerClick: (d: Detection) => void;
}

const CrimeMap: React.FC<CrimeMapProps> = ({ detections, selectedDetection, onMarkerClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // Fix: Use any type for Google Maps objects as global namespace might not be defined in TS
  const googleMap = useRef<any | null>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const infoWindowRef = useRef<any | null>(null);
  const routeRendererRef = useRef<any | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);

  const mapDetections = useMemo(() => detections, [detections]);

  const markerDetections = useMemo(() => {
    return mapDetections.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
  }, [mapDetections]);

  const getMarkerColor = useCallback((d: Detection) => {
    return d.priority === 'High' ? '#ef4444' : d.priority === 'Medium' ? '#f59e0b' : '#10b981';
  }, []);

  const mapStyles = useMemo(() => ([
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  ]), []);

  useEffect(() => {
    // Fix: Cast window to any to access google property without TS errors
    const win = window as any;
    if (mapRef.current && !googleMap.current && win.google) {
      googleMap.current = new win.google.maps.Map(mapRef.current, {
        center: { lat: 4.2105, lng: 101.9758 }, // Malaysia Center
        zoom: 6,
        disableDefaultUI: true,
        styles: mapStyles,
      });
      infoWindowRef.current = new win.google.maps.InfoWindow();
    }
  }, [mapStyles]);

  useEffect(() => {
    const win = window as any;
    if (win.google?.maps) return;

    const timeoutId = window.setTimeout(() => {
      if (!win.google?.maps) {
        setMapError("");
      }
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    // Fix: Use local cast reference to safely access google methods and constants
    const win = window as any;
    if (!googleMap.current || !win.google) return;

    // Clear old markers that are no longer in detections
    Object.keys(markersRef.current).forEach(id => {
      if (!markerDetections.find(d => d.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    markerDetections.forEach(d => {
      const isSelected = selectedDetection?.id === d.id;
      const markerIcon = {
        path: "M12 2C7.59 2 4 5.59 4 10c0 5.47 6.63 11.87 7.02 12.23a1.5 1.5 0 0 0 1.96 0C13.37 21.87 20 15.47 20 10c0-4.41-3.59-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
        fillColor: getMarkerColor(d),
        fillOpacity: 1,
        strokeWeight: 0,
        scale: isSelected ? 2.2 : 1.5,
        anchor: new win.google.maps.Point(12, 24),
      };

      if (!markersRef.current[d.id]) {
        const marker = new win.google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map: googleMap.current,
          title: d.animal_type,
          icon: markerIcon,
        });

        marker.addListener('click', () => {
          const locationLabel = d.location_name || "";
          const coords = `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}`;
          const confidence = Number.isFinite(d.confidence)
            ? `${Math.round(d.confidence * 100)}%`
            : "";
          const priority = d.priority || "";
          const status = d.status || "Pending";
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(
              `<div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #e2e8f0; background: #0f172a; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.25); box-shadow: 0 10px 24px rgba(2, 6, 23, 0.55); min-width: 180px;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #f8fafc;">${d.animal_type || "Case"}</div>
                <div style="font-size: 10px; color: #10b981; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 6px;">Case ${d.id}</div>
                ${locationLabel ? `<div style="margin-bottom: 6px; color: #94a3b8;">${locationLabel}</div>` : ""}
                <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                  ${priority ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;">${priority}</span>` : ""}
                  ${confidence ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(148, 163, 184, 0.1); font-size: 10px;">${confidence} Conf</span>` : ""}
                  ${status ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.1); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;">${status}</span>` : ""}
                </div>
                <div style="color: #34d399; font-family: 'JetBrains Mono', monospace; font-size: 11px;">${coords}</div>
              </div>`
            );
            infoWindowRef.current.open({ map: googleMap.current, anchor: marker });
          }
          onMarkerClick(d);
        });
        markersRef.current[d.id] = marker;
      } else {
        // Update color if priority changed (though mock data is static)
        markersRef.current[d.id].setIcon(markerIcon);
      }
    });
  }, [getMarkerColor, markerDetections, onMarkerClick, selectedDetection?.id]);

  useEffect(() => {
    // Fix: Use casted window to trigger map animations safely
    const win = window as any;
    if (googleMap.current && selectedDetection && win.google) {
      if (!Number.isFinite(selectedDetection.lat) || !Number.isFinite(selectedDetection.lng)) return;
      googleMap.current.panTo({ lat: selectedDetection.lat, lng: selectedDetection.lng });
      googleMap.current.setZoom(10);
      
      // Animate the selected marker
      const marker = markersRef.current[selectedDetection.id];
      if (marker) {
        marker.setAnimation(win.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 1500);
      }
    }
  }, [selectedDetection]);

  useEffect(() => {
    const win = window as any;
    if (!googleMap.current || !win.google || mapDetections.length === 0) return;

    const nextBoundsKey = mapDetections
      .map((d) => `${d.id}:${d.lat},${d.lng}`)
      .sort()
      .join("|");
    if (googleMap.current.__boundsKey === nextBoundsKey) {
      return;
    }
    googleMap.current.__boundsKey = nextBoundsKey;

    if (mapDetections.length === 1) {
      const only = mapDetections[0];
      if (!Number.isFinite(only.lat) || !Number.isFinite(only.lng)) return;
      googleMap.current.setCenter({ lat: only.lat, lng: only.lng });
      googleMap.current.setZoom(8);
      return;
    }

    const bounds = new win.google.maps.LatLngBounds();
    mapDetections.forEach((d) => {
      if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return;
      bounds.extend(new win.google.maps.LatLng(d.lat, d.lng));
    });

    googleMap.current.fitBounds(bounds, 80);
  }, [mapDetections]);

  const requestUserLocation = useCallback(async () => {
    if (!navigator.geolocation) return null;

    return await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const parseManualLocation = (value: string | null) => {
    if (!value) return null;
    const [latRaw, lngRaw] = value.split(",").map((entry) => entry.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const handlePatrolRoute = useCallback(async () => {
    const win = window as any;
    if (!googleMap.current || !win.google?.maps) {
      setRouteStatus("Google Maps not ready.");
      return;
    }

    if (!selectedDetection || !Number.isFinite(selectedDetection.lat) || !Number.isFinite(selectedDetection.lng)) {
      setRouteStatus("Select a case to build a route.");
      return;
    }

    setRouteStatus("Fetching current location...");
    let origin = await requestUserLocation();
    if (!origin) {
      const manual = window.prompt("Enter your location as lat,lng");
      origin = parseManualLocation(manual);
    }

    if (!origin) {
      setRouteStatus("Unable to determine your location.");
      return;
    }

    const destination = { lat: selectedDetection.lat, lng: selectedDetection.lng };
    const originLatLng = new win.google.maps.LatLng(origin.lat, origin.lng);
    const destinationLatLng = new win.google.maps.LatLng(destination.lat, destination.lng);

    if (!routeRendererRef.current) {
      routeRendererRef.current = new win.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: "#38bdf8",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        },
      });
    }

    routeRendererRef.current.setMap(googleMap.current);

    const service = new win.google.maps.DirectionsService();
    service.route(
      {
        origin: originLatLng,
        destination: destinationLatLng,
        travelMode: win.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === "OK" && result) {
          routeRendererRef.current.setDirections(result);
          setRouteStatus("Optimized route to case ready.");
        } else {
          const hint = status === "REQUEST_DENIED"
            ? "Check Maps API key, Directions API, and billing."
            : status === "ZERO_RESULTS"
              ? "No driving route found."
              : "";
          setRouteStatus(`Unable to build route to case (${status}). ${hint}`.trim());
          if (routeRendererRef.current) {
            routeRendererRef.current.setMap(null);
          }
        }
      }
    );
  }, [requestUserLocation, selectedDetection]);

  const handleSeeAll = useCallback(() => {
    const win = window as any;
    if (!googleMap.current || !win.google || markerDetections.length === 0) return;

    if (markerDetections.length === 1) {
      const only = markerDetections[0];
      if (!Number.isFinite(only.lat) || !Number.isFinite(only.lng)) return;
      googleMap.current.setCenter({ lat: only.lat, lng: only.lng });
      googleMap.current.setZoom(8);
      return;
    }

    const bounds = new win.google.maps.LatLngBounds();
    markerDetections.forEach((d) => {
      if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return;
      bounds.extend(new win.google.maps.LatLng(d.lat, d.lng));
    });

    googleMap.current.fitBounds(bounds, 80);
  }, [markerDetections]);

  return (
    <div className="w-full h-full relative group">
      <div ref={mapRef} className="w-full h-full" />

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-slate-200 text-xs font-mono tracking-widest uppercase">
          {mapError}
        </div>
      )}
      
      {/* HUD Overlays */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="bg-slate-950/80 border border-emerald-500/20 px-3 py-1 rounded backdrop-blur text-[10px] font-mono text-emerald-400 pointer-events-none">
          SAT_LOCK: ACTIVE
        </div>
        <button
          type="button"
          onClick={handleSeeAll}
          className="px-3 py-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-mono uppercase tracking-widest text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
        >
          See All
        </button>
      </div>

      {/* Crosshair Simulation Overlay */}
      <div className="absolute inset-0 pointer-events-none border border-emerald-500/10">
        <div className="absolute top-1/2 left-0 w-8 h-px bg-emerald-500/30"></div>
        <div className="absolute top-1/2 right-0 w-8 h-px bg-emerald-500/30"></div>
        <div className="absolute top-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
        <div className="absolute bottom-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 p-3 rounded-lg shadow-2xl">
          <h3 className="text-emerald-400 text-[10px] uppercase font-mono mb-2">Smart Patrol Route</h3>
          <button
            type="button"
            onClick={handlePatrolRoute}
            className="px-3 py-2 rounded border border-sky-400/60 bg-sky-400/10 text-[10px] font-mono uppercase tracking-widest text-sky-200 hover:border-sky-300 hover:text-sky-100"
          >
            Optimized Route Only
          </button>
          {routeStatus && (
            <div className="mt-2 text-[10px] text-slate-400 font-mono">{routeStatus}</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default CrimeMap;
