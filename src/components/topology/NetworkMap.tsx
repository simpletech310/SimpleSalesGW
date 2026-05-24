"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Cloud, Shield, Network, Wifi, Server, HardDrive, Monitor } from "lucide-react";
import type { TopologyGraph, TopologyKind } from "@/lib/topology/extractor";

/**
 * v2.23 — Interactive network map driven by the deterministic
 * TopologyGraph (no LLM in the loop). Uses react-flow for pan/zoom
 * + the same tier-based layout the SVG print renderer uses.
 */

const RANK: Record<TopologyKind, number> = {
  internet: 0,
  firewall: 1,
  switch: 2,
  ap: 3,
  server: 3,
  storage: 3,
  "endpoint-summary": 3,
};

const ICON: Record<TopologyKind, React.ComponentType<{ className?: string }>> = {
  internet: Cloud,
  firewall: Shield,
  switch: Network,
  ap: Wifi,
  server: Server,
  storage: HardDrive,
  "endpoint-summary": Monitor,
};

const ACCENT: Record<TopologyKind, string> = {
  internet: "border-blue-400 bg-blue-50",
  firewall: "border-red-400 bg-red-50",
  switch: "border-green-400 bg-green-50",
  ap: "border-purple-400 bg-purple-50",
  server: "border-amber-400 bg-amber-50",
  storage: "border-slate-400 bg-slate-50",
  "endpoint-summary": "border-gray-400 bg-gray-50",
};

const COL_X = 280;
const ROW_Y = 96;

type CustomNodeData = {
  kind: TopologyKind;
  label: string;
  sublabel?: string;
};

function CustomNode({ data }: NodeProps<CustomNodeData>) {
  const Icon = ICON[data.kind];
  return (
    <div className={`rounded-md border-2 ${ACCENT[data.kind]} px-3 py-2 min-w-[180px] shadow-sm`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gtn-navy" />
        <p className="text-sm font-semibold text-gtn-navy">{data.label}</p>
      </div>
      {data.sublabel && <p className="text-[10px] text-gtn-grey-2 mt-0.5">{data.sublabel}</p>}
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export function NetworkMap({ graph, height = 540 }: { graph: TopologyGraph; height?: number }) {
  const { nodes, edges } = useMemo(() => {
    // Tier nodes by RANK for x; index-within-rank for y.
    const byRank = new Map<number, typeof graph.nodes>();
    for (const n of graph.nodes) {
      const r = RANK[n.kind] ?? 99;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(n);
    }
    const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
    const rfNodes: Node[] = [];
    ranks.forEach((rank, col) => {
      const items = byRank.get(rank)!;
      items.forEach((n, row) => {
        rfNodes.push({
          id: n.id,
          type: "custom",
          position: { x: col * COL_X, y: row * ROW_Y },
          data: { kind: n.kind, label: n.label, sublabel: n.sublabel },
        });
      });
    });

    const rfEdges: Edge[] = graph.edges.map((e, i) => ({
      id: `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.sublabel,
      animated: e.kind === "wan",
      style: e.kind === "mgmt" ? { strokeDasharray: "4 3", stroke: "#9CA3AF" } : undefined,
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30 p-6 text-center text-sm text-gtn-grey-2">
        No inventory captured yet. Add a firewall, switch, or other asset to see the topology.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gtn-lavender-2" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
