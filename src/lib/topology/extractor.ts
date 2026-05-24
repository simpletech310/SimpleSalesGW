/**
 * v2.23 — Programmatic network-topology extractor.
 *
 * Pure-TypeScript reduction of the v2.1-F inventory tables into a
 * {nodes, edges} graph. NO LLM in the loop — this is deterministic
 * math driven by what the vCIO captured during the site survey.
 *
 * Heuristics:
 *   - One synthetic `internet` node per site that has any NetworkCircuit.
 *   - FirewallAsset(s) per site attach to their site's `internet` node.
 *     Multi-firewall sites are HA-paired with a mgmt edge between them
 *     and a single "primary" (most-recent firmware_version wins).
 *   - SwitchAsset(s) attach up to their site's primary firewall.
 *     We pick a "core switch" (highest port count) as the fan-in target
 *     for downstream devices to keep the visual readable.
 *   - AccessPoint, ServerAsset, StorageAsset attach to the core switch.
 *   - EndpointSummary becomes one aggregate node ("N workstations").
 *
 * The output is stable: identical inputs produce identical {nodes,
 * edges}, regardless of row-fetch order. This is important so the
 * react-flow + SVG renderers don't shuffle on every page reload.
 */

import { prisma } from "@/lib/prisma";

export type TopologyKind =
  | "internet"
  | "firewall"
  | "switch"
  | "ap"
  | "server"
  | "storage"
  | "endpoint-summary";

export type TopologyNode = {
  id: string;
  kind: TopologyKind;
  label: string;
  sublabel?: string;
  siteId?: string | null;
  inventoryRef?: { tableName: string; id: string };
};

export type TopologyEdge = {
  source: string;
  target: string;
  kind: "wan" | "lan" | "wlan" | "mgmt";
  sublabel?: string;
};

export type TopologyGraph = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  sites: Array<{ id: string; label: string; isPrimary: boolean }>;
  extractedAt: string;
};

const stableSiteId = (siteId: string | null | undefined): string => siteId ?? "no-site";

/**
 * Build a deterministic network graph for a customer (optionally
 * filtered to a single site).
 */
export async function extractTopology(
  customerId: string,
  opts: { siteId?: string } = {},
): Promise<TopologyGraph> {
  const where = { customerId, ...(opts.siteId ? { siteId: opts.siteId } : {}) };

  const [sites, circuits, firewalls, switches, aps, servers, storage, endpoints] =
    await Promise.all([
      prisma.site.findMany({
        where: { customerId },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: { id: true, name: true, isPrimary: true },
      }),
      prisma.networkCircuit.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { isFailover: "asc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, provider: true, type: true, bandwidthDown: true, bandwidthUp: true, isFailover: true },
      }),
      prisma.firewallAsset.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { firmwareVersion: "desc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, vendor: true, model: true, serialNumber: true, firmwareVersion: true },
      }),
      prisma.switchAsset.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { portCount: "desc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, vendor: true, model: true, portCount: true, mgmtIp: true, isStacked: true },
      }),
      prisma.accessPoint.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { vendor: "asc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, vendor: true, model: true, count: true },
      }),
      prisma.serverAsset.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { hostname: "asc" }],
        select: { id: true, siteId: true, hostname: true, role: true, virtual: true },
      }),
      prisma.storageAsset.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { vendor: "asc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, vendor: true, model: true, type: true, capacityTb: true, backupTarget: true },
      }),
      prisma.endpointSummary.findMany({
        where,
        orderBy: [{ siteId: "asc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, count: true },
      }),
    ]);

  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  // Group circuits + firewalls + switches per site so we can decide
  // the primary firewall + core switch per site deterministically.
  const sitesById = new Map<string, { id: string; name: string; isPrimary: boolean }>();
  for (const s of sites) sitesById.set(s.id, s);

  // Bucket inventory by stable site key
  const bySite = <T extends { siteId: string | null }>(arr: T[]) => {
    const m = new Map<string, T[]>();
    for (const item of arr) {
      const k = stableSiteId(item.siteId);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(item);
    }
    return m;
  };

  const circuitsBySite = bySite(circuits);
  const firewallsBySite = bySite(firewalls);
  const switchesBySite = bySite(switches);
  const apsBySite = bySite(aps);
  const serversBySite = bySite(servers);
  const storageBySite = bySite(storage);
  const endpointsBySite = bySite(endpoints);

  // Walk all stable site keys we've seen (real sites + a "no-site" bucket
  // for inventory that hasn't been assigned to a site yet).
  const allSiteKeys = new Set<string>([
    ...Array.from(circuitsBySite.keys()),
    ...Array.from(firewallsBySite.keys()),
    ...Array.from(switchesBySite.keys()),
    ...Array.from(apsBySite.keys()),
    ...Array.from(serversBySite.keys()),
    ...Array.from(storageBySite.keys()),
    ...Array.from(endpointsBySite.keys()),
  ]);

  // Stable ordering of sites: real sites in their fetched order, then
  // the "no-site" bucket last.
  const orderedSiteKeys = [
    ...sites.map((s) => s.id).filter((k) => allSiteKeys.has(k)),
    ...(allSiteKeys.has("no-site") ? ["no-site"] : []),
  ];

  for (const siteKey of orderedSiteKeys) {
    const site = sitesById.get(siteKey);
    const siteLabel = site?.name ?? "Unassigned";

    const siteCircuits = circuitsBySite.get(siteKey) ?? [];
    const siteFirewalls = firewallsBySite.get(siteKey) ?? [];
    const siteSwitches = switchesBySite.get(siteKey) ?? [];
    const siteAps = apsBySite.get(siteKey) ?? [];
    const siteServers = serversBySite.get(siteKey) ?? [];
    const siteStorage = storageBySite.get(siteKey) ?? [];
    const siteEndpoints = endpointsBySite.get(siteKey) ?? [];

    // 1) Internet node if any circuit exists at this site.
    let internetNodeId: string | null = null;
    if (siteCircuits.length > 0) {
      internetNodeId = `internet-${siteKey}`;
      const totalDown = siteCircuits.reduce((s, c) => s + (c.bandwidthDown ?? 0), 0);
      nodes.push({
        id: internetNodeId,
        kind: "internet",
        label: `Internet · ${siteLabel}`,
        sublabel: totalDown > 0 ? `${totalDown} Mbps down across ${siteCircuits.length} circuit${siteCircuits.length === 1 ? "" : "s"}` : `${siteCircuits.length} circuit${siteCircuits.length === 1 ? "" : "s"}`,
        siteId: site?.id,
      });
    }

    // 2) Firewalls — primary = the first (already sorted by firmware desc).
    const fwNodes: TopologyNode[] = [];
    siteFirewalls.forEach((fw, i) => {
      const id = `fw-${fw.id}`;
      const label = `${fw.vendor}${fw.model ? ` ${fw.model}` : ""}`;
      fwNodes.push({
        id,
        kind: "firewall",
        label,
        sublabel: i === 0 ? "Primary" : "HA",
        siteId: site?.id,
        inventoryRef: { tableName: "FirewallAsset", id: fw.id },
      });
      nodes.push(fwNodes[i]!);
      if (internetNodeId) {
        edges.push({ source: internetNodeId, target: id, kind: "wan" });
      }
    });
    // HA pair: link siblings to primary with mgmt edges
    if (fwNodes.length > 1) {
      const primary = fwNodes[0]!;
      for (let i = 1; i < fwNodes.length; i++) {
        edges.push({ source: primary.id, target: fwNodes[i]!.id, kind: "mgmt", sublabel: "HA" });
      }
    }
    const primaryFwId = fwNodes[0]?.id;

    // 3) Switches — first one is "core" by sort order (highest port count).
    const swNodes: TopologyNode[] = [];
    siteSwitches.forEach((sw, i) => {
      const id = `sw-${sw.id}`;
      const label = `${sw.vendor}${sw.model ? ` ${sw.model}` : ""}`;
      swNodes.push({
        id,
        kind: "switch",
        label,
        sublabel: sw.portCount ? `${sw.portCount}p${sw.isStacked ? " · stacked" : ""}${i === 0 ? " · core" : ""}` : i === 0 ? "core" : undefined,
        siteId: site?.id,
        inventoryRef: { tableName: "SwitchAsset", id: sw.id },
      });
      nodes.push(swNodes[i]!);
      // Attach each switch to the primary firewall (if any), otherwise to internet
      const upstreamId = primaryFwId ?? internetNodeId;
      if (upstreamId) edges.push({ source: upstreamId, target: id, kind: "lan" });
    });
    const coreSwitchId = swNodes[0]?.id;
    // Inter-switch mgmt edges (core ↔ access)
    if (swNodes.length > 1 && coreSwitchId) {
      for (let i = 1; i < swNodes.length; i++) {
        edges.push({ source: coreSwitchId, target: swNodes[i]!.id, kind: "mgmt" });
      }
    }

    // Pick the fan-in target for downstream gear: core switch > primary fw > internet.
    const fanInId = coreSwitchId ?? primaryFwId ?? internetNodeId;

    // 4) APs
    for (const ap of siteAps) {
      const id = `ap-${ap.id}`;
      nodes.push({
        id,
        kind: "ap",
        label: `${ap.vendor}${ap.model ? ` ${ap.model}` : ""}`,
        sublabel: ap.count > 1 ? `× ${ap.count}` : undefined,
        siteId: site?.id,
        inventoryRef: { tableName: "AccessPoint", id: ap.id },
      });
      if (fanInId) edges.push({ source: fanInId, target: id, kind: "wlan" });
    }

    // 5) Servers
    for (const sv of siteServers) {
      const id = `srv-${sv.id}`;
      nodes.push({
        id,
        kind: "server",
        label: sv.hostname,
        sublabel: sv.role ? `${sv.virtual ? "VM · " : ""}${sv.role}` : sv.virtual ? "VM" : undefined,
        siteId: site?.id,
        inventoryRef: { tableName: "ServerAsset", id: sv.id },
      });
      if (fanInId) edges.push({ source: fanInId, target: id, kind: "lan" });
    }

    // 6) Storage
    for (const st of siteStorage) {
      const id = `stor-${st.id}`;
      const cap = st.capacityTb ? `${Number(st.capacityTb).toFixed(0)} TB` : "";
      nodes.push({
        id,
        kind: "storage",
        label: `${st.vendor}${st.model ? ` ${st.model}` : ""}`,
        sublabel: [String(st.type), cap, st.backupTarget ? "backup" : null].filter(Boolean).join(" · "),
        siteId: site?.id,
        inventoryRef: { tableName: "StorageAsset", id: st.id },
      });
      if (fanInId) edges.push({ source: fanInId, target: id, kind: "lan" });
    }

    // 7) Endpoint summary — one aggregate node per site
    const totalEndpoints = siteEndpoints.reduce((s, e) => s + (e.count ?? 0), 0);
    if (totalEndpoints > 0) {
      const id = `ep-${siteKey}`;
      nodes.push({
        id,
        kind: "endpoint-summary",
        label: `${totalEndpoints} workstation${totalEndpoints === 1 ? "" : "s"}`,
        sublabel: siteLabel,
        siteId: site?.id,
      });
      if (fanInId) edges.push({ source: fanInId, target: id, kind: "lan" });
    }
  }

  return {
    nodes,
    edges,
    sites: sites.map((s) => ({ id: s.id, label: s.name, isPrimary: s.isPrimary })),
    extractedAt: new Date().toISOString(),
  };
}
