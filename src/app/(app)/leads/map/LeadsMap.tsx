"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapLead = {
  id: string;
  name: string;
  stage: string;
  // v3.3.23 — industry drives the icon glyph inside each marker
  industry: string;
  dq: number;
  city: string | null;
  state: string | null;
  teamName: string | null;
  lat: number;
  lng: number;
};

/**
 * v3.3.23 — Per-industry SVG path. We inline path-d strings (Lucide-
 * derived) so each marker can render a tiny industry glyph centered
 * inside the stage-colored circle. Reps glance and immediately know
 * "that's a hospital" vs "that's a law firm" vs "that's a warehouse"
 * without opening a popup.
 */
const INDUSTRY_ICON: Record<string, string> = {
  // Cross / first-aid (heart pulse) — medical
  MEDICAL: "M22 12h-4l-3 9L9 3l-3 9H2",
  // Scale of justice — legal
  LEGAL: "M7 21h10 M12 3v18 M5 7l-3 6h6zM19 7l-3 6h6z",
  // Flag — federal contracting
  FEDERAL_CONTRACTING: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15",
  // Factory — manufacturing
  MANUFACTURING: "M2 20h20V8l-6 4V8l-6 4V4H2z M6 16h2 M10 16h2 M14 16h2",
  // Utensils — hospitality
  HOSPITALITY: "M3 2v7c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V2 M7 22v-9 M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
  // Dollar sign — financial services
  FINANCIAL_SERVICES: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  // Briefcase — professional services
  PROFESSIONAL_SERVICES: "M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  // Graduation cap — education
  EDUCATION: "M22 10v6 M6 12.5V16c0 1.66 4.03 3 9 3s9-1.34 9-3v-3.5 M2 10l10-5 10 5-10 5z",
  // Heart — nonprofit
  NONPROFIT: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  // Building generic — fallback
  OTHER: "M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4",
};

function iconSvg(industry: string, color: string): string {
  const path = INDUSTRY_ICON[industry] ?? INDUSTRY_ICON.OTHER;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="${path}"/></svg>`;
}

// v3.3.22 — MSP-friendly stage palette. New stages slot into the
// purple→blue→green→amber→red ramp matching the canonical flow.
const STAGE_COLOR: Record<string, string> = {
  LEAD: "#8B5CF6",                   // gtn-purple
  QUALIFIED: "#6366F1",
  FIRST_INTERACTION: "#4F46E5",
  SITE_SURVEY_SCHEDULED: "#2563EB",
  DISCOVERY: "#3B82F6",
  QUOTE_IN_PROGRESS: "#0891B2",
  QUOTE_SENT: "#0D9488",
  NEGOTIATION: "#EF4444",
  CLOSED_WON: "#16A34A",
  CLOSED_LOST: "#9CA3AF",
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
        // v3.3.24 — Mapbox positions the marker root via `transform:
        // translate(...)`. If we set transform on the same element for
        // hover (scale), it clobbers the translate and the marker snaps
        // to the top-left of the map. Solution: a 2-layer marker.
        // - Outer wrapper: zero size, Mapbox owns its transform
        // - Inner pin: holds the visuals, can be transformed freely on hover
        const el = document.createElement("div");
        el.style.cssText = `width: 0; height: 0; position: relative;`;

        const pin = document.createElement("div");
        pin.style.cssText = `
          position: absolute; left: -14px; top: -14px;
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 120ms ease-out;
          transform-origin: center;
        `;
        pin.innerHTML = iconSvg(l.industry, "#ffffff");
        // Scale the pin (NOT the marker root) so Mapbox's positioning
        // transform on `el` is preserved.
        pin.addEventListener("mouseenter", () => { pin.style.transform = "scale(1.18)"; });
        pin.addEventListener("mouseleave", () => { pin.style.transform = "scale(1)"; });
        el.appendChild(pin);

        if (l.dq > 0) {
          const dqBadge = document.createElement("div");
          dqBadge.textContent = String(l.dq);
          dqBadge.style.cssText = `
            position: absolute; bottom: -4px; right: -6px;
            background: #111827; color: white; font: 600 9px system-ui;
            border-radius: 9px; padding: 1px 4px; min-width: 12px;
            text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.4);
          `;
          pin.appendChild(dqBadge);
        }

        const industryLabel = l.industry.replace(/_/g, " ").toLowerCase();
        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <p style="font-weight: 600; margin: 0 0 4px; color: #111827;">${escapeHtml(l.name)}</p>
            <p style="margin: 0 0 2px; font-size: 11px; color: #6B7280;">
              <span style="text-transform: capitalize;">${escapeHtml(industryLabel)}</span> · ${l.stage.replace(/_/g, " ").toLowerCase()}
            </p>
            <p style="margin: 0 0 2px; font-size: 11px; color: #6B7280;">
              DQ ${l.dq}${l.teamName ? ` · ${escapeHtml(l.teamName)}` : ""}
            </p>
            <p style="margin: 0 0 8px; font-size: 11px; color: #6B7280;">
              ${[l.city, l.state].filter((s): s is string => Boolean(s)).map(escapeHtml).join(", ")}
            </p>
            <a href="/leads/${l.id}" style="color: #7C3AED; font-size: 12px; text-decoration: underline; font-weight: 500;">Open lead →</a>
          </div>
        `;

        new mapboxgl.Marker({ element: el })
          .setLngLat([l.lng, l.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml))
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
