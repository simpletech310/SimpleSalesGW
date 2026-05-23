/**
 * Inventory entity registry — single source of truth for the 10 tables on
 * the Customer's Inventory tab. Each entry maps to a Prisma delegate, lists
 * its editable fields, and labels them for the UI.
 */

import { Prisma } from "@prisma/client";

export type InventoryEntityKey =
  | "sites"
  | "circuits"
  | "firewalls"
  | "switches"
  | "access-points"
  | "servers"
  | "storage"
  | "endpoints"
  | "licenses"
  | "vendors";

export const INVENTORY_ENTITIES: InventoryEntityKey[] = [
  "sites",
  "circuits",
  "firewalls",
  "switches",
  "access-points",
  "servers",
  "storage",
  "endpoints",
  "licenses",
  "vendors",
];

export const INVENTORY_LABELS: Record<InventoryEntityKey, string> = {
  sites: "Sites",
  circuits: "Network Circuits",
  firewalls: "Firewalls",
  switches: "Switches",
  "access-points": "Wireless APs",
  servers: "Servers",
  storage: "Storage",
  endpoints: "Endpoint Summary",
  licenses: "Licenses",
  vendors: "Vendor Contracts",
};

/** Editable field columns shown in the table UI per entity. */
export type FieldDef = {
  key: string;
  label: string;
  type: "string" | "number" | "decimal" | "boolean" | "date" | "select";
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Whether the field is required on create. */
  required?: boolean;
};

const CIRCUIT_TYPES = [
  { value: "FIBER", label: "Fiber" },
  { value: "CABLE", label: "Cable" },
  { value: "DSL", label: "DSL" },
  { value: "MPLS", label: "MPLS" },
  { value: "WIRELESS", label: "Wireless" },
  { value: "SATELLITE", label: "Satellite" },
  { value: "OTHER", label: "Other" },
];
const STORAGE_TYPES = [
  { value: "NAS", label: "NAS" },
  { value: "SAN", label: "SAN" },
  { value: "DAS", label: "DAS" },
  { value: "CLOUD", label: "Cloud" },
  { value: "OTHER", label: "Other" },
];
const LICENSE_TYPES = [
  { value: "M365", label: "Microsoft 365" },
  { value: "GWS", label: "Google Workspace" },
  { value: "SAAS", label: "SaaS" },
  { value: "PERPETUAL", label: "Perpetual" },
  { value: "OTHER", label: "Other" },
];

export const INVENTORY_FIELDS: Record<InventoryEntityKey, ReadonlyArray<FieldDef>> = {
  sites: [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "address", label: "Address", type: "string" },
    { key: "city", label: "City", type: "string" },
    { key: "state", label: "State", type: "string" },
    { key: "zip", label: "ZIP", type: "string" },
    { key: "isPrimary", label: "Primary", type: "boolean" },
    { key: "sqft", label: "Sq ft", type: "number" },
    { key: "headcount", label: "Headcount", type: "number" },
  ],
  circuits: [
    { key: "siteId", label: "Site", type: "select" }, // populated from Sites list at runtime
    { key: "provider", label: "Provider", type: "string", required: true },
    { key: "type", label: "Type", type: "select", options: CIRCUIT_TYPES },
    { key: "bandwidthDown", label: "Down (Mbps)", type: "number" },
    { key: "bandwidthUp", label: "Up (Mbps)", type: "number" },
    { key: "monthlyCost", label: "Monthly $", type: "decimal" },
    { key: "contractEnd", label: "Contract end", type: "date" },
    { key: "isFailover", label: "Failover", type: "boolean" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  firewalls: [
    { key: "siteId", label: "Site", type: "select" },
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "model", label: "Model", type: "string" },
    { key: "serialNumber", label: "Serial", type: "string" },
    { key: "firmwareVersion", label: "Firmware", type: "string" },
    { key: "eolDate", label: "EOL date", type: "date" },
    { key: "supportContract", label: "Support", type: "string" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  switches: [
    { key: "siteId", label: "Site", type: "select" },
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "model", label: "Model", type: "string" },
    { key: "portCount", label: "Ports", type: "number" },
    { key: "mgmtIp", label: "Mgmt IP", type: "string" },
    { key: "isStacked", label: "Stacked", type: "boolean" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  "access-points": [
    { key: "siteId", label: "Site", type: "select" },
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "model", label: "Model", type: "string" },
    { key: "count", label: "Count", type: "number" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  servers: [
    { key: "siteId", label: "Site", type: "select" },
    { key: "hostname", label: "Hostname", type: "string", required: true },
    { key: "role", label: "Role", type: "string" },
    { key: "osVersion", label: "OS", type: "string" },
    { key: "cpuCores", label: "CPU cores", type: "number" },
    { key: "ramGb", label: "RAM GB", type: "number" },
    { key: "storageGb", label: "Storage GB", type: "number" },
    { key: "virtual", label: "Virtual", type: "boolean" },
    { key: "hypervisor", label: "Hypervisor", type: "string" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  storage: [
    { key: "siteId", label: "Site", type: "select" },
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "model", label: "Model", type: "string" },
    { key: "capacityTb", label: "Capacity TB", type: "decimal" },
    { key: "type", label: "Type", type: "select", options: STORAGE_TYPES },
    { key: "backupTarget", label: "Backup target", type: "boolean" },
    { key: "notes", label: "Notes", type: "string" },
  ],
  endpoints: [
    { key: "siteId", label: "Site", type: "select" },
    { key: "count", label: "Count", type: "number", required: true },
    { key: "avgAgeMonths", label: "Avg age (mo)", type: "number" },
    { key: "lastInventoriedAt", label: "Last inventoried", type: "date" },
    { key: "notes", label: "Notes (OS mix in notes)", type: "string" },
  ],
  licenses: [
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "product", label: "Product", type: "string", required: true },
    { key: "seats", label: "Seats", type: "number" },
    { key: "costPerSeat", label: "$/seat", type: "decimal" },
    { key: "renewalDate", label: "Renewal", type: "date" },
    { key: "type", label: "Type", type: "select", options: LICENSE_TYPES },
    { key: "notes", label: "Notes", type: "string" },
  ],
  vendors: [
    { key: "vendor", label: "Vendor", type: "string", required: true },
    { key: "service", label: "Service", type: "string" },
    { key: "contractStart", label: "Start", type: "date" },
    { key: "contractEnd", label: "End", type: "date" },
    { key: "autoRenew", label: "Auto-renew", type: "boolean" },
    { key: "monthlyCost", label: "Monthly $", type: "decimal" },
    { key: "contact", label: "Contact", type: "string" },
    { key: "notes", label: "Notes", type: "string" },
  ],
};

/** Map entity key → Prisma model delegate name. */
export type PrismaInventoryDelegate = {
  sites: Prisma.SiteDelegate;
  circuits: Prisma.NetworkCircuitDelegate;
  firewalls: Prisma.FirewallAssetDelegate;
  switches: Prisma.SwitchAssetDelegate;
  "access-points": Prisma.AccessPointDelegate;
  servers: Prisma.ServerAssetDelegate;
  storage: Prisma.StorageAssetDelegate;
  endpoints: Prisma.EndpointSummaryDelegate;
  licenses: Prisma.LicenseEntryDelegate;
  vendors: Prisma.VendorContractDelegate;
};

/** Get the Prisma delegate by entity key (typed return). */
export function delegateFor(entity: InventoryEntityKey, prisma: import("@prisma/client").PrismaClient) {
  switch (entity) {
    case "sites":         return prisma.site;
    case "circuits":      return prisma.networkCircuit;
    case "firewalls":     return prisma.firewallAsset;
    case "switches":      return prisma.switchAsset;
    case "access-points": return prisma.accessPoint;
    case "servers":       return prisma.serverAsset;
    case "storage":       return prisma.storageAsset;
    case "endpoints":     return prisma.endpointSummary;
    case "licenses":      return prisma.licenseEntry;
    case "vendors":       return prisma.vendorContract;
  }
}

/** Coerce raw form values into the shape Prisma expects (Decimal, Date, etc). */
export function coerceForWrite(field: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (field.type) {
    case "number":
      return typeof raw === "string" ? Number(raw) : raw;
    case "decimal":
      return typeof raw === "string" || typeof raw === "number"
        ? new Prisma.Decimal(raw)
        : raw;
    case "boolean":
      if (typeof raw === "boolean") return raw;
      return raw === "true" || raw === "1" || raw === "on";
    case "date":
      return typeof raw === "string" ? new Date(raw) : raw;
    default:
      return raw;
  }
}
