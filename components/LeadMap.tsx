"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "@/lib/types";
import L from "leaflet";

// This component dynamically adjusts the map bounds as new leads stream in
function MapBounds({ leads }: { leads: Lead[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (leads.length > 0) {
      const bounds = L.latLngBounds(leads.map(l => [l.lat, l.lng]));
      // Only animate if bounds are valid, zoom out to fit all points
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 0.5 });
    }
  }, [leads, map]);

  return null;
}

export default function LeadMap({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return <div className="h-[320px] rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">Map appears once leads are scraped</div>;
  }
  
  // Set initial center safely based on the very first lead to avoid map container re-initialization errors
  const initialCenter: [number, number] = [leads[0].lat, leads[0].lng];

  return (
    <div className="h-[320px] rounded-lg overflow-hidden border border-border">
      <MapContainer 
        key="lead-map-container"
        center={initialCenter} 
        zoom={14} 
        className="h-full w-full" 
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        <MapBounds leads={leads} />
        {leads.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.lat, l.lng]}
            radius={7}
            pathOptions={{ color: "#7a5c3e", fillColor: "#a8866a", fillOpacity: 0.85, weight: 1.5 }}
          >
            <Tooltip>{l.name}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
