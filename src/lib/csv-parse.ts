/**
 * Tiny RFC 4180 CSV parser — no dependency. Handles quoted fields with
 * embedded commas, newlines, and escaped double-quotes (""). First row
 * is treated as headers.
 *
 * Returns `{ headers, rows }` where rows are `Record<header, string>`.
 * Empty cells become empty string; trailing newlines and a possible UTF-8 BOM
 * are stripped.
 */

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(text: string): ParsedCsv {
  // Strip BOM
  let s = text.replace(/^﻿/, "");
  // Normalize CRLF / CR → LF
  s = s.replace(/\r\n?/g, "\n");

  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += ch;
    }
  }
  // Final field
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  // Drop trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1]!.every((c) => c.trim() === "")) {
    rows.pop();
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0]!.map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c]!;
      obj[h] = (row[c] ?? "").trim();
    }
    out.push(obj);
  }
  return { headers, rows: out };
}

/**
 * Match an arbitrary header from a sloppy CSV to a known field name.
 * Lower-cases, strips spaces / underscores / dashes, then looks up against
 * a table of synonyms. Returns the canonical key or null.
 */
export function normalizeHeader(raw: string): string | null {
  const k = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[k] ?? null;
}

const HEADER_ALIASES: Record<string, string> = {
  // businessName
  businessname: "businessName",
  companyname: "businessName",
  company: "businessName",
  name: "businessName",
  legalname: "businessName",
  account: "businessName",
  accountname: "businessName",
  // dbaName
  dbaname: "dbaName",
  dba: "dbaName",
  tradename: "dbaName",
  // industry
  industry: "industry",
  vertical: "industry",
  // subindustry
  subindustry: "subindustry",
  niche: "subindustry",
  // seatCount
  seatcount: "seatCount",
  seats: "seatCount",
  employees: "seatCount",
  employeecount: "seatCount",
  headcount: "seatCount",
  users: "seatCount",
  // siteCount
  sitecount: "siteCount",
  sites: "siteCount",
  locations: "siteCount",
  offices: "siteCount",
  // address
  street: "addressStreet",
  address: "addressStreet",
  address1: "addressStreet",
  addressstreet: "addressStreet",
  city: "addressCity",
  addresscity: "addressCity",
  state: "addressState",
  addressstate: "addressState",
  zip: "addressZip",
  postalcode: "addressZip",
  zipcode: "addressZip",
  addresszip: "addressZip",
  // urls
  website: "websiteUrl",
  websiteurl: "websiteUrl",
  url: "websiteUrl",
  domain: "websiteUrl",
  linkedin: "linkedinCompanyUrl",
  linkedinurl: "linkedinCompanyUrl",
  linkedincompanyurl: "linkedinCompanyUrl",
  google: "googleBusinessUrl",
  googleurl: "googleBusinessUrl",
  googlebusiness: "googleBusinessUrl",
  googlebusinessurl: "googleBusinessUrl",
  googlemaps: "googleBusinessUrl",
  // contact
  contactname: "primaryContactName",
  contact: "primaryContactName",
  primarycontact: "primaryContactName",
  primarycontactname: "primaryContactName",
  contacttitle: "primaryContactTitle",
  title: "primaryContactTitle",
  primarycontacttitle: "primaryContactTitle",
  email: "primaryContactEmail",
  contactemail: "primaryContactEmail",
  primarycontactemail: "primaryContactEmail",
  phone: "primaryContactPhone",
  contactphone: "primaryContactPhone",
  primarycontactphone: "primaryContactPhone",
  // sponsor
  sponsor: "executiveSponsorName",
  executivesponsor: "executiveSponsorName",
  executivesponsorname: "executiveSponsorName",
  sponsortitle: "executiveSponsorTitle",
  executivesponsortitle: "executiveSponsorTitle",
  // current MSP
  currentmsp: "currentMspName",
  currentmspname: "currentMspName",
  msp: "currentMspName",
  // misc
  notes: "notes",
  note: "notes",
  source: "source",
  dealkind: "dealKind",
  deal: "dealKind",
};
