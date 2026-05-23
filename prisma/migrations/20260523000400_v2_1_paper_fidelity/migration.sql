-- v2.1 — paper-fidelity sweep: inventory workbook + signed documents + NIST 800-171 discovery kind.

-- New DiscoveryKind value
ALTER TYPE "DiscoveryKind" ADD VALUE 'NIST_800_171';

-- New enums
CREATE TYPE "SignedDocType" AS ENUM ('MSA', 'SOW', 'BAA', 'NDA', 'DPA', 'AMENDMENT', 'OTHER');
CREATE TYPE "SignedDocStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'SUPERSEDED');
CREATE TYPE "CircuitType" AS ENUM ('FIBER', 'CABLE', 'DSL', 'MPLS', 'WIRELESS', 'SATELLITE', 'OTHER');
CREATE TYPE "StorageType" AS ENUM ('NAS', 'SAN', 'DAS', 'CLOUD', 'OTHER');
CREATE TYPE "LicenseType" AS ENUM ('M365', 'GWS', 'SAAS', 'PERPETUAL', 'OTHER');

-- Sites (parent of most other inventory tables)
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "sqft" INTEGER,
    "headcount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sites_customer_id_idx" ON "sites"("customer_id");
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Network circuits
CREATE TABLE "network_circuits" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "provider" TEXT NOT NULL,
    "type" "CircuitType" NOT NULL DEFAULT 'OTHER',
    "bandwidth_down" INTEGER,
    "bandwidth_up" INTEGER,
    "monthly_cost" DECIMAL(10,2),
    "contract_end" TIMESTAMP(3),
    "is_failover" BOOLEAN NOT NULL DEFAULT FALSE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "network_circuits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "network_circuits_customer_id_idx" ON "network_circuits"("customer_id");
CREATE INDEX "network_circuits_site_id_idx" ON "network_circuits"("site_id");
ALTER TABLE "network_circuits" ADD CONSTRAINT "network_circuits_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_circuits" ADD CONSTRAINT "network_circuits_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Firewall assets
CREATE TABLE "firewall_assets" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "serial_number" TEXT,
    "firmware_version" TEXT,
    "eol_date" TIMESTAMP(3),
    "support_contract" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "firewall_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "firewall_assets_customer_id_idx" ON "firewall_assets"("customer_id");
ALTER TABLE "firewall_assets" ADD CONSTRAINT "firewall_assets_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "firewall_assets" ADD CONSTRAINT "firewall_assets_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Switch assets
CREATE TABLE "switch_assets" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "port_count" INTEGER,
    "mgmt_ip" TEXT,
    "is_stacked" BOOLEAN NOT NULL DEFAULT FALSE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "switch_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "switch_assets_customer_id_idx" ON "switch_assets"("customer_id");
ALTER TABLE "switch_assets" ADD CONSTRAINT "switch_assets_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "switch_assets" ADD CONSTRAINT "switch_assets_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Access points
CREATE TABLE "access_points" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "access_points_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "access_points_customer_id_idx" ON "access_points"("customer_id");
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Server assets
CREATE TABLE "server_assets" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "hostname" TEXT NOT NULL,
    "role" TEXT,
    "os_version" TEXT,
    "cpu_cores" INTEGER,
    "ram_gb" INTEGER,
    "storage_gb" INTEGER,
    "virtual" BOOLEAN NOT NULL DEFAULT FALSE,
    "hypervisor" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "server_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "server_assets_customer_id_idx" ON "server_assets"("customer_id");
ALTER TABLE "server_assets" ADD CONSTRAINT "server_assets_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_assets" ADD CONSTRAINT "server_assets_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Storage assets
CREATE TABLE "storage_assets" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "capacity_tb" DECIMAL(8,2),
    "type" "StorageType" NOT NULL DEFAULT 'OTHER',
    "backup_target" BOOLEAN NOT NULL DEFAULT FALSE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "storage_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "storage_assets_customer_id_idx" ON "storage_assets"("customer_id");
ALTER TABLE "storage_assets" ADD CONSTRAINT "storage_assets_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storage_assets" ADD CONSTRAINT "storage_assets_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Endpoint summaries
CREATE TABLE "endpoint_summaries" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "site_id" UUID,
    "count" INTEGER NOT NULL DEFAULT 0,
    "os_mix" JSONB NOT NULL DEFAULT '{}',
    "avg_age_months" INTEGER,
    "last_inventoried_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "endpoint_summaries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "endpoint_summaries_customer_id_idx" ON "endpoint_summaries"("customer_id");
ALTER TABLE "endpoint_summaries" ADD CONSTRAINT "endpoint_summaries_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "endpoint_summaries" ADD CONSTRAINT "endpoint_summaries_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- License entries
CREATE TABLE "license_entries" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "seats" INTEGER,
    "cost_per_seat" DECIMAL(10,2),
    "renewal_date" TIMESTAMP(3),
    "type" "LicenseType" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "license_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "license_entries_customer_id_idx" ON "license_entries"("customer_id");
ALTER TABLE "license_entries" ADD CONSTRAINT "license_entries_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vendor contracts
CREATE TABLE "vendor_contracts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor" TEXT NOT NULL,
    "service" TEXT,
    "contract_start" TIMESTAMP(3),
    "contract_end" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT FALSE,
    "monthly_cost" DECIMAL(10,2),
    "contact" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vendor_contracts_customer_id_idx" ON "vendor_contracts"("customer_id");
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Signed documents
CREATE TABLE "signed_documents" (
    "id" UUID NOT NULL,
    "lead_id" UUID,
    "customer_id" UUID,
    "type" "SignedDocType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SignedDocStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_by_name" TEXT,
    "signed_by_email" TEXT,
    "signed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "superseded_by_id" UUID,
    "storage_path" TEXT,
    "public_url" TEXT,
    "content_type" TEXT,
    "byte_size" INTEGER,
    "uploaded_by_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "signed_documents_superseded_by_id_key" ON "signed_documents"("superseded_by_id");
CREATE INDEX "signed_documents_lead_id_idx" ON "signed_documents"("lead_id");
CREATE INDEX "signed_documents_customer_id_idx" ON "signed_documents"("customer_id");
CREATE INDEX "signed_documents_type_status_idx" ON "signed_documents"("type", "status");
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_superseded_by_id_fkey"
    FOREIGN KEY ("superseded_by_id") REFERENCES "signed_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
