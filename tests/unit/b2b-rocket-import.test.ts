import { describe, it, expect } from "vitest";
import { Industry } from "@prisma/client";
import {
  isB2BRocketCsv,
  normalizeB2BRocketRow,
  mapIndustry,
} from "@/lib/prospects/b2b-rocket";

// A representative B2B Rocket / bebop.ai export row (column order matches the
// real file). Contact 1 is the same person as the Primary Contact.
const ROW: Record<string, string> = {
  ID: "349957",
  "Company Name": "Mccabe & Ali Llp",
  Industry: "Law Practice",
  Score: "86.0",
  "Primary Contact Name": "Michael Mccabe",
  "Primary Contact Job Title": "Managing Partner",
  "Intent Topics": "Data Privacy and Protection, Malware Attacks",
  Description: "McCabe & Ali LLP is a small Los Angeles-area law firm focused on IP ethics.",
  Reason: "Encino law firm (11-25) within radius with managing partner contact; very good fit.",
  "Playbook URL": "https://bebop.ai/playbooks/playbook-df00ad9c/?pw=abc",
  "Created At": "2026-06-13T03:35:55.621031",
  "Updated At": "2026-06-13T03:35:55.621031",
  "Contact 1 Name": "Michael Mccabe",
  "Contact 1 Job Title": "Managing Partner",
  "Contact 1 Email": "michael@mccabeali.com",
  "Contact 1 Phone Number": "+13015381110",
  "Contact 1 Linkedin URL": "linkedin.com/in/ipethics",
  "Contact 1 Location": "Plymouth, MA",
  "Contact 2 Name": "Emil Ali",
  "Contact 2 Job Title": "Partner",
  "Contact 2 Email": "emil@mccabeali.com",
  "Contact 2 Phone Number": "+15624131503",
  "Contact 2 Linkedin URL": "linkedin.com/in/emilali",
  "Contact 2 Location": "Cerritos, CA",
  "Contact 3 Name": "",
  "Contact 3 Job Title": "",
  "Contact 3 Email": "",
  "Contact 3 Phone Number": "",
  "Contact 3 Linkedin URL": "",
  "Contact 3 Location": "",
};

describe("isB2BRocketCsv", () => {
  it("detects the B2B Rocket export by header signature", () => {
    expect(isB2BRocketCsv(Object.keys(ROW))).toBe(true);
  });

  it("does not misclassify a plain CSV that merely has a company column", () => {
    expect(isB2BRocketCsv(["Company Name", "Phone", "City"])).toBe(false);
  });

  it("ignores a UTF-8 BOM on the first header", () => {
    expect(isB2BRocketCsv(["﻿ID", "Company Name", "Intent Topics", "Reason"])).toBe(true);
  });
});

describe("mapIndustry", () => {
  it("maps law/legal labels to LEGAL", () => {
    expect(mapIndustry("Law Practice").industry).toBe(Industry.LEGAL);
    expect(mapIndustry("Legal Services").industry).toBe(Industry.LEGAL);
  });
  it("maps accounting/finance labels to FINANCIAL_SERVICES", () => {
    expect(mapIndustry("Accounting").industry).toBe(Industry.FINANCIAL_SERVICES);
  });
  it("falls back to OTHER for unknown labels", () => {
    const r = mapIndustry("Underwater Basket Weaving");
    expect(r.industry).toBe(Industry.OTHER);
    expect(r.matched).toBe(false);
  });
});

describe("normalizeB2BRocketRow", () => {
  const { data, errors, warnings } = normalizeB2BRocketRow(ROW);

  it("produces no errors for a well-formed row", () => {
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(data).toBeDefined();
  });

  it("maps the core company + vendor fields", () => {
    expect(data!.businessName).toBe("Mccabe & Ali Llp");
    expect(data!.industry).toBe(Industry.LEGAL);
    expect(data!.subindustry).toBe("Law Practice");
    expect(data!.externalLeadId).toBe("349957");
    expect(data!.vendorLeadScore).toBe(86);
    expect(data!.vendorScoreSource).toBe("B2B Rocket");
    expect(data!.playbookUrl).toBe("https://bebop.ai/playbooks/playbook-df00ad9c/?pw=abc");
  });

  it("splits intent topics into a clean array", () => {
    expect(data!.intentTopics).toEqual(["Data Privacy and Protection", "Malware Attacks"]);
  });

  it("maps the prose research onto the research surface", () => {
    expect(data!.researchSummary).toContain("McCabe & Ali LLP");
    expect(data!.researchFitSignals).toEqual([
      "Encino law firm (11-25) within radius with managing partner contact; very good fit.",
    ]);
    expect(data!.researchCompletedAt).toBeInstanceOf(Date);
    expect(data!.enrichmentSource).toBe("b2b_rocket_csv");
  });

  it("collects all non-empty contacts into keyContacts", () => {
    const contacts = data!.keyContacts as Array<Record<string, unknown>>;
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      name: "Michael Mccabe",
      title: "Managing Partner",
      role: "Decision-maker",
      email: "michael@mccabeali.com",
      sourceUrl: "https://linkedin.com/in/ipethics",
      location: "Plymouth, MA",
    });
  });

  it("promotes the matching contact's email/phone to the primary contact", () => {
    expect(data!.primaryContactName).toBe("Michael Mccabe");
    expect(data!.primaryContactEmail).toBe("michael@mccabeali.com");
    expect(data!.primaryContactPhone).toBe("+13015381110");
  });

  it("requires a company name", () => {
    const res = normalizeB2BRocketRow({ "Company Name": "" });
    expect(res.errors).toContain("Company Name is required");
    expect(res.data).toBeUndefined();
  });

  it("warns but still imports when the score is non-numeric", () => {
    const res = normalizeB2BRocketRow({ "Company Name": "X", Score: "n/a" });
    expect(res.data!.vendorLeadScore).toBeUndefined();
    expect(res.warnings.join(" ")).toMatch(/Score/);
  });
});
