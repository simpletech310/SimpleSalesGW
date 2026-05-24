"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapLead = {
  id: string;
  name: string;
  stage: string;
  dq: number;
  city: string | null;
  state: string | null;
  teamName: string | null;
  lat: number;
  lng: number;
};

const STAGE_COLOR: Record<string, string> = {
  LEAD: "#8B5CF6",          // gtn-purple
  QUALIFIED: "#6366F1",
  DISCOVERY: "#3B82F6",
  PRE_SALES: "#10B981",
  PROPOSAL: "#F59E0B",
  NEGOTIATION: "#EF4444",
  CLOSED_WON: "#16A34A",
  CLOSED_LOST: "#9CA3AF",
  NURTURE: "#A855F7",
};

export function LeadsMap({ leads }: { leads: MapLead[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-118.3287, 34.1808], // Burbank
      zoom: 6,
    });
    mapRef.current = map;

    map.on("load", () => {
      if (leads.length === 0) return;

      const lngs = leads.map((l) => l.lng);
      const lats = leads.map((l) => l.lat);
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, animate: false });

      for (const l of leads) {
        const color = STAGE_COLOR[l.stage] ?? "#8B5CF6";
        const el = document.createElement("div");
        el.style.cssText = `
          width: 16px; height: 16px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
        `;

        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; min-width: 180px;">
            <p style="font-weight: 600; margin: 0 0 4px;">${escapeHtml(l.name)}</p>
            <p style="margin: 0 0 2px; font-size: 11px; color: #6B7280;">
              ${l.stage.replace(/_/g, " ")} · DQ ${l.dq}
              ${l.teamName ? ` · ${escapeHtml(l.teamName)}` : ""}
            </p>
            <p style="margin: 0 0 6px; font-size: 11px; color: #6B7280;">
              ${[l.city, l.state].filter((s): s is string => Boolean(s)).map(escapeHtml).join(", ")}
            </p>
            <a href="/leads/${l.id}" style="color: #7C3AED; font-size: 12px; text-decoration: underline;">Open lead →</a>
          </div>
        `;

        new mapboxgl.Marker({ element: el })
          .setLngLat([l.lng, l.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml))
          .addTo(map);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    return (
      <div className="p-4 text-xs text-gtn-grey-2">
        Map disabled — <code>NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN</code> not set.
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[600px]" />
      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur rounded-md border border-gtn-lavender-2 p-2 text-xs space-y-1">
        <p className="font-semibold text-gtn-navy mb-1">Stage</p>
        {Object.entries(STAGE_COLOR).map(([stage, color]) => {
          const count = leads.filter((l) => l.stage === stage).length;
          if (count === 0) return null;
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-gtn-grey-2">{stage.replace(/_/g, " ").toLowerCase()}</span>
              <span className="ml-auto font-mono text-gtn-grey-3">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
