
import React, { useEffect, useRef, useState } from 'react';
import { Detection } from '../types';

interface CrimeMapProps {
  detections: Detection[];
  selectedDetection: Detection | null;
  onMarkerClick: (d: Detection) => void;
  showHeatmap: boolean;
}

const CrimeMap: React.FC<CrimeMapProps> = ({ detections, selectedDetection, onMarkerClick, showHeatmap }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // Fix: Use any type for Google Maps objects as global namespace might not be defined in TS
  const googleMap = useRef<any | null>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const heatmapRef = useRef<any | null>(null);
  const infoWindowRef = useRef<any | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // Fix: Cast window to any to access google property without TS errors
    const win = window as any;
    if (mapRef.current && !googleMap.current && win.google) {
      // Initialize map with a dark style
      googleMap.current = new win.google.maps.Map(mapRef.current, {
        center: { lat: 4.2105, lng: 101.9758 }, // Malaysia Center
        zoom: 6,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
          { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ]
      });
      infoWindowRef.current = new win.google.maps.InfoWindow();
    }
  }, []);

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
      if (!detections.find(d => d.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    detections.forEach(d => {
      if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return;
      const markerIcon = {
        path: "M12 2C7.59 2 4 5.59 4 10c0 5.47 6.63 11.87 7.02 12.23a1.5 1.5 0 0 0 1.96 0C13.37 21.87 20 15.47 20 10c0-4.41-3.59-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
        fillColor: d.priority === 'High' ? '#ef4444' : '#10b981',
        fillOpacity: 1,
        strokeWeight: 0,
        scale: 1.5,
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
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(
              `<div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #e2e8f0; background: #0f172a; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.25); box-shadow: 0 10px 24px rgba(2, 6, 23, 0.55); min-width: 180px;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #f8fafc;">${d.animal_type || "Case"}</div>
                <div style="font-size: 10px; color: #10b981; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 6px;">Case ${d.id}</div>
                ${locationLabel ? `<div style="margin-bottom: 6px; color: #94a3b8;">${locationLabel}</div>` : ""}
                <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                  ${priority ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;">${priority}</span>` : ""}
                  ${confidence ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(148, 163, 184, 0.1); font-size: 10px;">${confidence} Conf</span>` : ""}
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
  }, [detections, onMarkerClick]);

  useEffect(() => {
    const win = window as any;
    if (!googleMap.current || !win.google?.maps?.visualization) return;

    if (!heatmapRef.current) {
      heatmapRef.current = new win.google.maps.visualization.HeatmapLayer({
        data: [],
        radius: 28,
        opacity: 0.75,
      });
    }

    heatmapRef.current.setMap(showHeatmap ? googleMap.current : null);
  }, [showHeatmap]);

  useEffect(() => {
    const win = window as any;
    if (!heatmapRef.current || !win.google) return;

    const weightedPoints = detections
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      .map((d) => {
      const priorityWeight = d.priority === "High" ? 3 : d.priority === "Medium" ? 2 : 1;
      return {
        location: new win.google.maps.LatLng(d.lat, d.lng),
        weight: Math.max(0.5, d.confidence * priorityWeight),
      };
    });

    heatmapRef.current.setData(weightedPoints);
  }, [detections]);

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

  return (
    <div className="w-full h-full relative group">
      <div ref={mapRef} className="w-full h-full" />

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-slate-200 text-xs font-mono tracking-widest uppercase">
          {mapError}
        </div>
      )}
      
      {/* HUD Overlays */}
      <div className="absolute top-4 right-4 pointer-events-none space-y-2">
         <div className="bg-slate-950/80 border border-emerald-500/20 px-3 py-1 rounded backdrop-blur text-[10px] font-mono text-emerald-400">
           SAT_LOCK: ACTIVE
         </div>
      </div>

      {/* Crosshair Simulation Overlay */}
      <div className="absolute inset-0 pointer-events-none border border-emerald-500/10">
        <div className="absolute top-1/2 left-0 w-8 h-px bg-emerald-500/30"></div>
        <div className="absolute top-1/2 right-0 w-8 h-px bg-emerald-500/30"></div>
        <div className="absolute top-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
        <div className="absolute bottom-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
      </div>
    </div>
  );
};

export default CrimeMap;
