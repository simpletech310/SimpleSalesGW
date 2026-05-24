/**
 * v2.23 — Deterministic SVG layout for the network topology graph.
 *
 * Print-safe — no react-flow, no canvas. Reads a TopologyGraph and
 * emits an SVG string with each node as a labeled rectangle, edges as
 * orthogonal-ish polylines, and a small legend.
 *
 * Layout: tier-based left-to-right columns by node `kind` rank. Nodes
 * within a tier are stacked vertically and centered. Deterministic
 * across runs given the same input order (matches the extractor's
 * stable ordering).
 */

import type { TopologyEdge, TopologyGraph, TopologyKind, TopologyNode } from "./extractor";

// Visual rank (left → right). Internet on the left, endpoints on the right.
const RANK: Record<TopologyKind, number> = {
  internet: 0,
  firewall: 1,
  switch: 2,
  ap: 3,
  server: 3,
  storage: 3,
  "endpoint-summary": 3,
};

const COLOR: Record<TopologyKind, { fill: string; stroke: string; text: string }> = {
  internet:           { fill: "#EFF6FF", stroke: "#3B82F6", text: "#1E3A8A" },
  firewall:           { fill: "#FEF2F2", stroke: "#EF4444", text: "#7F1D1D" },
  switch:             { fill: "#F0FDF4", stroke: "#22C55E", text: "#14532D" },
  ap:                 { fill: "#FAF5FF", stroke: "#A855F7", text: "#581C87" },
  server:             { fill: "#FFFBEB", stroke: "#F59E0B", text: "#78350F" },
  storage:            { fill: "#F1F5F9", stroke: "#64748B", text: "#1E293B" },
  "endpoint-summary": { fill: "#FAFAFA", stroke: "#9CA3AF", text: "#374151" },
};

const KIND_LABEL: Record<TopologyKind, string> = {
  internet: "Internet",
  firewall: "Firewall",
  switch: "Switch",
  ap: "AP",
  server: "Server",
  storage: "Storage",
  "endpoint-summary": "Endpoints",
};

const NODE_W = 200;
const NODE_H = 60;
const COL_GAP = 80;
const ROW_GAP = 24;
const PAD = 30;
const LEGEND_H = 40;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function layoutToSvg(graph: TopologyGraph): string {
  // Bucket nodes by rank.
  const byRank = new Map<number, TopologyNode[]>();
  for (const n of graph.nodes) {
    const r = RANK[n.kind] ?? 99;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  }
  const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);

  // Compute coordinates per node.
  const pos = new Map<string, { x: number; y: number }>();
  const colHeights: number[] = [];
  ranks.forEach((rank, colIdx) => {
    const nodes = byRank.get(rank)!;
    const colHeight = nodes.length * NODE_H + (nodes.length - 1) * ROW_GAP;
    colHeights.push(colHeight);
    const x = PAD + colIdx * (NODE_W + COL_GAP);
    nodes.forEach((n, rowIdx) => {
      const y = PAD + rowIdx * (NODE_H + ROW_GAP);
      pos.set(n.id, { x, y });
    });
  });

  // SVG canvas size.
  const width =
    PAD * 2 +
    ranks.length * NODE_W +
    Math.max(0, ranks.length - 1) * COL_GAP;
  const height =
    PAD * 2 +
    Math.max(0, ...colHeights, NODE_H) +
    LEGEND_H;

  // Build edge polylines (orthogonal: out-right, mid-vertical, in-left).
  const edgeSvg = graph.edges
    .map((e) => edgeToPolyline(e, pos))
    .filter((s): s is string => Boolean(s))
    .join("\n");

  // Build node rects.
  const nodeSvg = graph.nodes
    .map((n) => {
      const p = pos.get(n.id);
      if (!p) return "";
      return nodeToRect(n, p.x, p.y);
    })
    .join("\n");

  // Legend at the bottom: one swatch per kind that's actually used.
  const usedKinds: TopologyKind[] = (Object.keys(KIND_LABEL) as TopologyKind[])
    .filter((k) => graph.nodes.some((n) => n.kind === k));
  const legendY = height - LEGEND_H + 10;
  const legendSvg = usedKinds
    .map((k, i) => {
      const lx = PAD + i * 110;
      const c = COLOR[k];
      return `
        <rect x="${lx}" y="${legendY}" width="14" height="14" rx="3"
              fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>
        <text x="${lx + 20}" y="${legendY + 11}" font-size="11" fill="#374151">${escapeXml(KIND_LABEL[k])}</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" font-family="system-ui, -apple-system, sans-serif">
  <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
  ${edgeSvg}
  ${nodeSvg}
  ${legendSvg}
</svg>`;
}

function nodeToRect(n: TopologyNode, x: number, y: number): string {
  const c = COLOR[n.kind];
  return `
    <g>
      <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="6"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>
      <text x="${x + 10}" y="${y + 22}" font-size="12" font-weight="600" fill="${c.text}">${escapeXml(n.label)}</text>
      ${n.sublabel ? `<text x="${x + 10}" y="${y + 42}" font-size="10" fill="#6B7280">${escapeXml(n.sublabel)}</text>` : ""}
    </g>
  `;
}

function edgeToPolyline(
  e: TopologyEdge,
  pos: Map<string, { x: number; y: number }>,
): string | null {
  const a = pos.get(e.source);
  const b = pos.get(e.target);
  if (!a || !b) return null;
  // Out from right of source, into left of target, with a vertical mid-segment.
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const mid = Math.round((x1 + x2) / 2);
  const points = `${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`;
  const stroke = e.kind === "wan" ? "#3B82F6"
    : e.kind === "wlan" ? "#A855F7"
    : e.kind === "mgmt" ? "#9CA3AF"
    : "#22C55E";
  const dash = e.kind === "mgmt" ? `stroke-dasharray="4 3"` : "";
  return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="1.5" ${dash}/>`;
}
