
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Detection } from '../types';

const getBrowserLocation = async (): Promise<{ lat: number; lng: number } | null> => {
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
};

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
  const originMarkerRef = useRef<any | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ duration?: string; distance?: string } | null>(null);
  const [routeSteps, setRouteSteps] = useState<Array<{ instruction: string; endLat: number; endLng: number; distance?: string; duration?: string }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isGuiding, setIsGuiding] = useState(false);
  const [guidanceStatus, setGuidanceStatus] = useState<string | null>(null);
  const lastInfoRef = useRef<{ detection: Detection; marker: any } | null>(null);
  const guidanceWatchRef = useRef<number | null>(null);
  const lastSpokenIndexRef = useRef<number | null>(null);
  const currentStepIndexRef = useRef(0);

  const mapDetections = useMemo(() => detections, [detections]);

  const markerDetections = useMemo(() => {
    return mapDetections.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
  }, [mapDetections]);

  const displayPositions = useMemo(() => {
    const positions: Record<string, { lat: number; lng: number }> = {};
    const groups = new Map<string, Detection[]>();
    markerDetections.forEach((d) => {
      const key = `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
      const existing = groups.get(key) || [];
      existing.push(d);
      groups.set(key, existing);
    });

    groups.forEach((items) => {
      if (items.length === 1) {
        const only = items[0];
        positions[only.id] = { lat: only.lat, lng: only.lng };
        return;
      }

      const goldenAngle = 2.399963229728653; // radians
      items.forEach((item, index) => {
        const radius = 0.001 + index * 0.00035;
        const angle = index * goldenAngle;
        positions[item.id] = {
          lat: item.lat + Math.cos(angle) * radius,
          lng: item.lng + Math.sin(angle) * radius,
        };
      });
    });

    return positions;
  }, [markerDetections]);

  const getMarkerColor = useCallback((d: Detection) => {
    return d.priority === 'High' ? '#ef4444' : d.priority === 'Medium' ? '#f59e0b' : '#10b981';
  }, []);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const toLat = (value: any) => (typeof value?.lat === "function" ? value.lat() : value?.lat);
  const toLng = (value: any) => (typeof value?.lng === "function" ? value.lng() : value?.lng);

  const distanceMeters = useCallback((a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
  }, []);

  const speakInstruction = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.speak(utterance);
  }, []);

  const buildInfoWindowContent = useCallback((d: Detection, location?: { lat: number; lng: number } | null) => {
    const locationLabel = d.location_name || "";
    const coords = `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}`;
    const confidence = Number.isFinite(d.confidence)
      ? `${Math.round(d.confidence * 100)}%`
      : "";
    const priority = d.priority || "";
    const status = d.status || "Pending";
    const currentCoords = location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Unknown";
    const sameLocationCases = detections.filter(
      (item) => item.id !== d.id && item.location_name && item.location_name === d.location_name
    );
    const relatedList = sameLocationCases.slice(0, 3)
      .map((item) => `${item.animal_type || "Case"} (${item.id})`)
      .join(" • ");

    return `
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #ffffff; background: #0b1220; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 12px 30px rgba(2, 6, 23, 0.65); min-width: 210px;">
        <div style="font-weight: 800; margin-bottom: 6px; color: #ffffff;">${d.animal_type || "Case"}</div>
        <div style="font-size: 10px; color: #34d399; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 6px; font-weight: 700;">Case ${d.id}</div>
        ${locationLabel ? `<div style="margin-bottom: 6px; color: #ffffff; font-weight: 700;">${locationLabel}</div>` : ""}
        <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
          ${priority ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.55); background: rgba(16, 185, 129, 0.18); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #ffffff; font-weight: 700;">${priority}</span>` : ""}
          ${confidence ? `<span style="padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.5); background: rgba(148, 163, 184, 0.15); font-size: 10px; color: #ffffff; font-weight: 700;">${confidence} Conf</span>` : ""}
        </div>
        <div style="color: #ffffff; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">Case Coords: ${coords}</div>
        <div style="margin-top: 6px; color: #ffffff; font-size: 11px; font-weight: 700;">Current Location: ${currentCoords}</div>
        ${sameLocationCases.length > 0 ? `
          <div style="margin-top: 8px; color: #e2e8f0; font-size: 10px; font-weight: 700;">
            Other cases nearby (${sameLocationCases.length}):
            <div style="margin-top: 4px; color: #ffffff; font-weight: 700;">${relatedList}${sameLocationCases.length > 3 ? " ..." : ""}</div>
          </div>
        ` : ""}
      </div>
    `;
  }, [detections]);

  const buildOriginInfoContent = useCallback((address?: string | null, location?: { lat: number; lng: number } | null) => {
    const coords = location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Unknown";
    return `
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #ffffff; background: #0b1220; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.5); box-shadow: 0 12px 30px rgba(2, 6, 23, 0.65); min-width: 200px;">
        <div style="font-weight: 700; margin-bottom: 6px; color: #ffffff;">Current Location (A)</div>
        <div style="font-size: 10px; color: #e2e8f0; font-weight: 700;">${address || "Address unavailable"}</div>
        <div style="margin-top: 6px; color: #ffffff; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">${coords}</div>
      </div>
    `;
  }, []);

  const updateCurrentAddress = useCallback((location: { lat: number; lng: number } | null) => {
    const win = window as any;
    if (!location || !win.google?.maps || !googleMap.current) return;
    const geocoder = new win.google.maps.Geocoder();
    geocoder.geocode({ location }, (results: any, status: string) => {
      console.log('🗺️ Geocode Status:', status);
      console.log('🗺️ Geocode Results:', results);
      if (status === "OK" && results?.[0]) {
        const address = results[0].formatted_address;
        setCurrentAddress(address);
        console.log('✅ Address Found:', address);
        // Update marker A's stored data
        if (originMarkerRef.current) {
          originMarkerRef.current.__originData = { location, address };
        }
      } else {
        setCurrentAddress(null);
        console.log('❌ Geocoding Failed:', status);
      }
    });
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
      const displayPosition = displayPositions[d.id] || { lat: d.lat, lng: d.lng };
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
          position: displayPosition,
          map: googleMap.current,
          title: d.animal_type,
          icon: markerIcon,
        });

        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(buildInfoWindowContent(d, currentLocation));
            infoWindowRef.current.open({ map: googleMap.current, anchor: marker });
          }
          lastInfoRef.current = { detection: d, marker };
          getBrowserLocation().then((location) => {
            if (location) {
              setCurrentLocation(location);
              updateCurrentAddress(location);
            }
          });
          onMarkerClick(d);
        });
        markersRef.current[d.id] = marker;
      } else {
        // Update color if priority changed (though mock data is static)
        markersRef.current[d.id].setIcon(markerIcon);
        markersRef.current[d.id].setPosition(displayPosition);
      }
    });
  }, [buildInfoWindowContent, currentLocation, displayPositions, getMarkerColor, markerDetections, onMarkerClick, selectedDetection?.id]);

  useEffect(() => {
    if (!currentLocation || !lastInfoRef.current || !infoWindowRef.current || !googleMap.current) return;
    infoWindowRef.current.setContent(
      buildInfoWindowContent(lastInfoRef.current.detection, currentLocation)
    );
    infoWindowRef.current.open({ map: googleMap.current, anchor: lastInfoRef.current.marker });
  }, [buildInfoWindowContent, currentLocation]);

  useEffect(() => {
    // Fix: Use casted window to trigger map animations safely
    const win = window as any;
    if (!googleMap.current || !win.google) return;

    if (selectedDetection) {
      // Zoom into selected case
      if (!Number.isFinite(selectedDetection.lat) || !Number.isFinite(selectedDetection.lng)) return;
      const focusPosition = displayPositions[selectedDetection.id] || { lat: selectedDetection.lat, lng: selectedDetection.lng };
      googleMap.current.panTo(focusPosition);
      googleMap.current.setZoom(10);
      
      // Animate the selected marker
      const marker = markersRef.current[selectedDetection.id];
      if (marker) {
        marker.setAnimation(win.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 1500);
      }
    } else if (markerDetections.length > 0) {
      // No selection - zoom out to show all markers (See All view)
      if (markerDetections.length === 1) {
        const only = markerDetections[0];
        const onlyPosition = displayPositions[only.id] || { lat: only.lat, lng: only.lng };
        if (Number.isFinite(onlyPosition.lat) && Number.isFinite(onlyPosition.lng)) {
          googleMap.current.setCenter(onlyPosition);
          googleMap.current.setZoom(8);
        }
      } else {
        const bounds = new win.google.maps.LatLngBounds();
        markerDetections.forEach((d) => {
          const markerPosition = displayPositions[d.id] || { lat: d.lat, lng: d.lng };
          if (Number.isFinite(markerPosition.lat) && Number.isFinite(markerPosition.lng)) {
            bounds.extend(new win.google.maps.LatLng(markerPosition.lat, markerPosition.lng));
          }
        });
        googleMap.current.fitBounds(bounds, 80);
      }
    }
  }, [displayPositions, selectedDetection, markerDetections]);

  useEffect(() => {
    const win = window as any;
    // Only auto-fit bounds when NO case is selected and markers change
    if (!googleMap.current || !win.google || mapDetections.length === 0 || selectedDetection) return;

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
      const onlyPosition = displayPositions[only.id] || { lat: only.lat, lng: only.lng };
      if (!Number.isFinite(onlyPosition.lat) || !Number.isFinite(onlyPosition.lng)) return;
      googleMap.current.setCenter(onlyPosition);
      googleMap.current.setZoom(8);
      return;
    }

    const bounds = new win.google.maps.LatLngBounds();
    mapDetections.forEach((d) => {
      const markerPosition = displayPositions[d.id] || { lat: d.lat, lng: d.lng };
      if (!Number.isFinite(markerPosition.lat) || !Number.isFinite(markerPosition.lng)) return;
      bounds.extend(new win.google.maps.LatLng(markerPosition.lat, markerPosition.lng));
    });

    googleMap.current.fitBounds(bounds, 80);
  }, [displayPositions, mapDetections, selectedDetection]);

  const buildRoute = useCallback((origin: { lat: number; lng: number } | null) => {
    const win = window as any;
    if (!googleMap.current || !win.google?.maps) {
      setRouteStatus("Google Maps not ready.");
      return;
    }

    if (!selectedDetection || !Number.isFinite(selectedDetection.lat) || !Number.isFinite(selectedDetection.lng)) {
      setRouteStatus("Select a case to build a route.");
      return;
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
        suppressMarkers: true,
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

    if (!originMarkerRef.current) {
      originMarkerRef.current = new win.google.maps.Marker({
        position: origin,
        map: googleMap.current,
        label: "A",
      });
      originMarkerRef.current.__originData = { location: origin, address: null };
      originMarkerRef.current.addListener("click", () => {
        if (infoWindowRef.current) {
          const data = originMarkerRef.current.__originData || { location: origin, address: null };
          infoWindowRef.current.setContent(buildOriginInfoContent(data.address, data.location));
          infoWindowRef.current.open({ map: googleMap.current, anchor: originMarkerRef.current });
        }
      });
    } else {
      originMarkerRef.current.setPosition(origin);
      originMarkerRef.current.setMap(googleMap.current);
      originMarkerRef.current.__originData = { location: origin, address: null };
    }

    updateCurrentAddress(origin);
    service.route(
      {
        origin: originLatLng,
        destination: destinationLatLng,
        travelMode: win.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === "OK" && result) {
          routeRendererRef.current.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          const duration = leg?.duration?.text;
          const distance = leg?.distance?.text;
          const steps = Array.isArray(leg?.steps)
            ? leg.steps
                .map((step: any) => {
                  const instruction = (step?.instructions || "").replace(/<[^>]+>/g, "").trim();
                  const endLat = toLat(step?.end_location);
                  const endLng = toLng(step?.end_location);
                  if (!instruction || !Number.isFinite(endLat) || !Number.isFinite(endLng)) return null;
                  return {
                    instruction,
                    endLat,
                    endLng,
                    distance: step?.distance?.text,
                    duration: step?.duration?.text,
                  };
                })
                .filter(Boolean)
            : [];
          setRouteSummary({ duration, distance });
          setRouteSteps(steps as Array<{ instruction: string; endLat: number; endLng: number; distance?: string; duration?: string }>);
          setCurrentStepIndex(0);
          lastSpokenIndexRef.current = null;
          setRouteStatus("Optimized route ready. Select Start to begin guidance.");
        } else {
          const hint = status === "REQUEST_DENIED"
            ? "Check Maps API key, Directions API, and billing."
            : status === "ZERO_RESULTS"
              ? "No driving route found."
              : "";
          setRouteStatus(`Unable to build route to case (${status}). ${hint}`.trim());
          setRouteSummary(null);
          setRouteSteps([]);
          setCurrentStepIndex(0);
          lastSpokenIndexRef.current = null;
          if (routeRendererRef.current) {
            routeRendererRef.current.setMap(null);
          }
        }
      }
    );
  }, [buildOriginInfoContent, currentAddress, currentLocation, selectedDetection, updateCurrentAddress]);

  const handlePatrolRoute = useCallback(async () => {
    setRouteStatus("Fetching current location...");
    const origin = await getBrowserLocation();
    if (origin) {
      setCurrentLocation(origin);
      updateCurrentAddress(origin);
      setRouteStatus("Location locked. Building route...");
      buildRoute(origin);
    } else {
      setRouteStatus("Unable to fetch current location. Please enable location permissions.");
    }
  }, [buildRoute, updateCurrentAddress]);

  useEffect(() => {
    if (!selectedDetection) return;
    setRouteStatus(null);
    setRouteSummary(null);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    lastSpokenIndexRef.current = null;
    if (routeRendererRef.current) {
      routeRendererRef.current.setMap(null);
    }
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
    }
  }, [selectedDetection?.id]);

  const stopGuidance = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (guidanceWatchRef.current !== null) {
      navigator.geolocation.clearWatch(guidanceWatchRef.current);
      guidanceWatchRef.current = null;
    }
    setIsGuiding(false);
    setGuidanceStatus("Guidance stopped.");
  }, []);

  const clearRoute = useCallback(() => {
    stopGuidance();
    setRouteStatus("Route cleared.");
    setRouteSummary(null);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    lastSpokenIndexRef.current = null;
    setGuidanceStatus(null);
    if (routeRendererRef.current) {
      routeRendererRef.current.setMap(null);
    }
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
    }
  }, [stopGuidance]);

  const handleStartGuidance = useCallback(() => {
    if (!routeSteps.length) {
      setGuidanceStatus("Build a route first.");
      return;
    }
    if (!navigator.geolocation) {
      setGuidanceStatus("Live guidance requires location access.");
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setGuidanceStatus("Voice guidance is not supported in this browser.");
      return;
    }

    if (guidanceWatchRef.current !== null) {
      navigator.geolocation.clearWatch(guidanceWatchRef.current);
    }

    // Open Waze with origin (current location) and destination
    if (selectedDetection && Number.isFinite(selectedDetection.lat) && Number.isFinite(selectedDetection.lng)) {
      const originParam = currentLocation 
        ? `&from=${currentLocation.lat},${currentLocation.lng}` 
        : '';
      const url = `https://waze.com/ul?ll=${selectedDetection.lat},${selectedDetection.lng}${originParam}&navigate=yes`;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    setIsGuiding(true);
    setGuidanceStatus("Live guidance started. Waze navigation opened."
    );

    const intro = `Route ready. Estimated time ${routeSummary?.duration || ""}. Distance ${routeSummary?.distance || ""}.`;
    speakInstruction(intro);

    guidanceWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const liveLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(liveLocation);

        const stepIndex = currentStepIndexRef.current;
        const step = routeSteps[stepIndex];
        if (!step) {
          speakInstruction("You have arrived at the destination.");
          setGuidanceStatus("Arrived at destination.");
          stopGuidance();
          return;
        }

        const remaining = distanceMeters(liveLocation, { lat: step.endLat, lng: step.endLng });
        if (remaining <= 35) {
          const nextIndex = stepIndex + 1;
          setCurrentStepIndex(nextIndex);
          if (lastSpokenIndexRef.current !== nextIndex) {
            lastSpokenIndexRef.current = nextIndex;
            const nextStep = routeSteps[nextIndex];
            if (nextStep) {
              speakInstruction(nextStep.instruction);
            } else {
              speakInstruction("You have arrived at the destination.");
              setGuidanceStatus("Arrived at destination.");
              stopGuidance();
            }
          }
        } else if (lastSpokenIndexRef.current === null) {
          lastSpokenIndexRef.current = stepIndex;
          speakInstruction(step.instruction);
        }
      },
      (error) => {
        console.error('Location watch error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGuidanceStatus("Location permission denied. Please enable location access.");
        } else if (error.code === error.TIMEOUT) {
          setGuidanceStatus("Location timeout. Retrying...");
          // Don't stop guidance on timeout, let it retry
        } else {
          setGuidanceStatus("Unable to access live location. Check GPS signal.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }, [currentLocation, distanceMeters, routeSteps, routeSummary, selectedDetection, speakInstruction, stopGuidance]);

  useEffect(() => {
    return () => {
      if (guidanceWatchRef.current !== null) {
        navigator.geolocation.clearWatch(guidanceWatchRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSeeAll = useCallback(() => {
    const win = window as any;
    if (!googleMap.current || !win.google || markerDetections.length === 0) return;

    if (markerDetections.length === 1) {
      const only = markerDetections[0];
      const onlyPosition = displayPositions[only.id] || { lat: only.lat, lng: only.lng };
      if (!Number.isFinite(onlyPosition.lat) || !Number.isFinite(onlyPosition.lng)) return;
      googleMap.current.setCenter(onlyPosition);
      googleMap.current.setZoom(8);
      return;
    }

    const bounds = new win.google.maps.LatLngBounds();
    markerDetections.forEach((d) => {
      const markerPosition = displayPositions[d.id] || { lat: d.lat, lng: d.lng };
      if (!Number.isFinite(markerPosition.lat) || !Number.isFinite(markerPosition.lng)) return;
      bounds.extend(new win.google.maps.LatLng(markerPosition.lat, markerPosition.lng));
    });

    googleMap.current.fitBounds(bounds, 80);
  }, [displayPositions, markerDetections]);

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
        {selectedDetection && (
          <div className="bg-slate-950/80 border border-emerald-500/20 px-3 py-1 rounded backdrop-blur text-[10px] font-mono text-emerald-400 pointer-events-none">
            SAT_LOCK: ACTIVE
          </div>
        )}
        <button
          type="button"
          onClick={handleSeeAll}
          className="px-3 py-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-mono uppercase tracking-widest text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
        >
          See All
        </button>
      </div>

      {/* Crosshair Simulation Overlay */}
      {selectedDetection && (
        <div className="absolute inset-0 pointer-events-none border border-emerald-500/10">
          <div className="absolute top-1/2 left-0 w-8 h-px bg-emerald-500/30"></div>
          <div className="absolute top-1/2 right-0 w-8 h-px bg-emerald-500/30"></div>
          <div className="absolute top-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
          <div className="absolute bottom-0 left-1/2 w-px h-8 bg-emerald-500/30"></div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        {selectedDetection && (
          <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 p-3 rounded-lg shadow-2xl">
            <h3 className="text-emerald-400 text-[10px] uppercase font-mono mb-2">Smart Patrol Route</h3>
            <button
              type="button"
              onClick={handlePatrolRoute}
              className="px-3 py-2 rounded border border-sky-400/60 bg-sky-400/10 text-[10px] font-mono uppercase tracking-widest text-sky-200 hover:border-sky-300 hover:text-sky-100"
            >
              Optimize Route
            </button>
            {(routeSummary || routeSteps.length > 0) && (
              <button
                type="button"
                onClick={clearRoute}
                className="mt-2 px-3 py-2 rounded border border-rose-400/60 bg-rose-500/10 text-[10px] font-mono uppercase tracking-widest text-rose-200 hover:border-rose-300 hover:text-rose-100"
              >
                Cancel Route
              </button>
            )}
            <button
              type="button"
              onClick={isGuiding ? stopGuidance : handleStartGuidance}
              className="mt-2 px-3 py-2 rounded border border-emerald-400/60 bg-emerald-500/10 text-[10px] font-mono uppercase tracking-widest text-emerald-200 hover:border-emerald-300 hover:text-emerald-100"
            >
              {isGuiding ? "Stop Guidance" : "Start Guidance"}
            </button>
            {routeSummary && (
              <div className="mt-2 text-[10px] text-slate-200 font-mono">
                ETA: {routeSummary.duration || "N/A"} • {routeSummary.distance || "N/A"}
              </div>
            )}
            {routeSteps.length > 0 && (
              <div className="mt-2 text-[10px] text-slate-300 font-mono">
                Step {Math.min(currentStepIndex + 1, routeSteps.length)} of {routeSteps.length}
              </div>
            )}
            {routeSteps[currentStepIndex] && (
              <div className="mt-1 text-[10px] text-slate-200 font-mono">
                Next: {routeSteps[currentStepIndex].instruction}
              </div>
            )}
            {routeStatus && (
              <div className="mt-2 text-[10px] text-slate-400 font-mono">{routeStatus}</div>
            )}
            {guidanceStatus && (
              <div className="mt-2 text-[10px] text-emerald-300 font-mono">{guidanceStatus}</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default CrimeMap;
