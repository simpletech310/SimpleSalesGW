import { describe, expect, it } from "vitest";
import { layoutToSvg } from "@/lib/topology/svgLayout";
import type { TopologyGraph } from "@/lib/topology/extractor";

const sampleGraph: TopologyGraph = {
  sites: [{ id: "site-a", label: "HQ", isPrimary: true }],
  nodes: [
    { id: "internet-site-a", kind: "internet", label: "Internet · HQ", sublabel: "1000 Mbps" },
    { id: "fw-1", kind: "firewall", label: "Sonicwall TZ470", sublabel: "Primary", siteId: "site-a" },
    { id: "sw-1", kind: "switch", label: "Cisco SG350", sublabel: "48p · core", siteId: "site-a" },
    { id: "ap-1", kind: "ap", label: "Ubiquiti U6-Pro", sublabel: "× 4", siteId: "site-a" },
    { id: "srv-1", kind: "server", label: "dc01", sublabel: "AD/DNS", siteId: "site-a" },
    { id: "stor-1", kind: "storage", label: "Synology RS1221+", sublabel: "NAS · 32 TB · backup", siteId: "site-a" },
    { id: "ep-site-a", kind: "endpoint-summary", label: "48 workstations", sublabel: "HQ" },
  ],
  edges: [
    { source: "internet-site-a", target: "fw-1", kind: "wan" },
    { source: "fw-1", target: "sw-1", kind: "lan" },
    { source: "sw-1", target: "ap-1", kind: "wlan" },
    { source: "sw-1", target: "srv-1", kind: "lan" },
    { source: "sw-1", target: "stor-1", kind: "lan" },
    { source: "sw-1", target: "ep-site-a", kind: "lan" },
  ],
  extractedAt: "2026-05-24T00:00:00.000Z",
};

describe("layoutToSvg", () => {
  it("returns a well-formed SVG string with viewBox + namespace", () => {
    const svg = layoutToSvg(sampleGraph);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
  });

  it("renders a <rect> for every node", () => {
    const svg = layoutToSvg(sampleGraph);
    // Each node is two rects (legend swatch + node card), each <rect>'s first
    // attribute is x. Filter to "data" rects by counting rx="6" (node radius).
    const nodeRectCount = (svg.match(/rx="6"/g) ?? []).length;
    expect(nodeRectCount).toBe(sampleGraph.nodes.length);
  });

  it("renders a <polyline> for every edge", () => {
    const svg = layoutToSvg(sampleGraph);
    const polyCount = (svg.match(/<polyline /g) ?? []).length;
    expect(polyCount).toBe(sampleGraph.edges.length);
  });

  it("contains the node label text (escaped)", () => {
    const svg = layoutToSvg(sampleGraph);
    for (const node of sampleGraph.nodes) {
      expect(svg).toContain(node.label);
    }
  });

  it("escapes special characters in labels", () => {
    const tricky: TopologyGraph = {
      ...sampleGraph,
      nodes: [{ id: "n1", kind: "server", label: "<bad> & \"thing\"" }],
      edges: [],
    };
    const svg = layoutToSvg(tricky);
    expect(svg).not.toContain("<bad>");
    expect(svg).toContain("&lt;bad&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
  });

  it("is deterministic across runs (cache-key stability)", () => {
    const a = layoutToSvg(sampleGraph);
    const b = layoutToSvg(sampleGraph);
    expect(a).toBe(b);
  });

  it("contains no NaN coordinates", () => {
    const svg = layoutToSvg(sampleGraph);
    expect(svg).not.toContain("NaN");
  });

  it("handles an empty graph gracefully (still wraps in <svg>)", () => {
    const empty: TopologyGraph = { nodes: [], edges: [], sites: [], extractedAt: "2026-05-24T00:00:00.000Z" };
    const svg = layoutToSvg(empty);
    expect(svg).toMatch(/^<svg /);
    expect((svg.match(/rx="6"/g) ?? []).length).toBe(0);
    expect((svg.match(/<polyline /g) ?? []).length).toBe(0);
  });

  it("orders nodes left-to-right by kind rank (internet leftmost)", () => {
    const svg = layoutToSvg(sampleGraph);
    // Internet node should be at the smallest x. We can pluck the x
    // value off the first rect of each node by matching label proximity.
    const internetX = matchNodeX(svg, "Internet · HQ");
    const switchX = matchNodeX(svg, "Cisco SG350");
    const apX = matchNodeX(svg, "Ubiquiti U6-Pro");
    expect(internetX).toBeLessThan(switchX);
    expect(switchX).toBeLessThan(apX);
  });
});

function matchNodeX(svg: string, label: string): number {
  // The label text element references the node's x+10 — we grab the
  // <text> for the label, parse its x attr, and subtract 10 back out.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<text x="(\\d+)"[^>]*>${escaped}</text>`);
  const m = svg.match(re);
  if (!m || !m[1]) throw new Error(`Label not found in SVG: ${label}`);
  return Number(m[1]) - 10;
}
