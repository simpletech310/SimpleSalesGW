"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

type Polygon = { type: "Polygon"; coordinates: number[][][] } | null;

/**
 * v2.22 — Mapbox Draw polygon editor for sales territory boundaries.
 *
 * Loads Mapbox GL JS + the Draw plugin. Initial polygon (if any) is
 * loaded into the Draw control; user can edit/delete/redraw and we
 * call `onChange(polygon | null)` on every change.
 *
 * Centered on Burbank, CA by default (Gateway HQ). Zoom 7 covers
 * most of Southern California — adjust the initial bbox to fit the
 * existing polygon if present.
 */
export function TerritoryPolygonEditor({
  value,
  onChange,
}: {
  value: Polygon;
  onChange: (p: Polygon) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-118.3287, 34.1808], // Burbank, CA
      zoom: 7,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw);

    map.on("load", () => {
      if (value) {
        try {
          draw.add({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: value.coordinates },
            properties: {},
          });
          // Fit to existing polygon
          const ring = value.coordinates[0];
          if (ring && ring.length > 0) {
            const lngs = ring.map((p) => p[0]).filter((n): n is number => typeof n === "number");
            const lats = ring.map((p) => p[1]).filter((n): n is number => typeof n === "number");
            if (lngs.length && lats.length) {
              const bounds = new mapboxgl.LngLatBounds(
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              );
              map.fitBounds(bounds, { padding: 40, animate: false });
            }
          }
        } catch {
          // ignore — bad polygon shape
        }
      }
    });

    function updateFromDraw() {
      const features = draw.getAll().features;
      const polygonFeat = features.find((f) => f.geometry.type === "Polygon");
      if (polygonFeat && polygonFeat.geometry.type === "Polygon") {
        onChange({
          type: "Polygon",
          coordinates: polygonFeat.geometry.coordinates as number[][][],
        });
      } else {
        onChange(null);
      }
    }

    map.on("draw.create", updateFromDraw);
    map.on("draw.update", updateFromDraw);
    map.on("draw.delete", updateFromDraw);

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once; updates flow through Draw events

  const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    return (
      <div className="rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30 p-4 text-xs text-gtn-grey-2">
        Map disabled — <code>NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN</code> not set.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full h-[420px] rounded-md border border-gtn-lavender-2" />
      <p className="text-[11px] text-gtn-grey-3">
        Click the polygon tool (top-right of the map), click points to draw, double-click to finish.
        Click a vertex to drag it; trash icon clears.
      </p>
    </div>
  );
}
