import type { Lead, AuditResult } from "./types";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

function getConfig() {
  const pat = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  return { pat, baseId, isConfigured: !!pat && !!baseId };
}

function getHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  };
}

// Table field definitions for auto-creation
const LEAD_TABLE_FIELDS = [
  { name: "Business Name", type: "singleLineText" },
  { name: "Category", type: "singleLineText" },
  { name: "Address", type: "singleLineText" },
  { name: "City", type: "singleLineText" },
  { name: "Phone", type: "phoneNumber" },
  { name: "WhatsApp", type: "phoneNumber" },
  { name: "Email", type: "email" },
  { name: "Website", type: "url" },
  { name: "Google Rating", type: "number", options: { precision: 1 } },
  { name: "Reviews Count", type: "number", options: { precision: 0 } },
  { name: "Latitude", type: "number", options: { precision: 6 } },
  { name: "Longitude", type: "number", options: { precision: 6 } },
  { name: "Scraped At", type: "dateTime", options: { timeZone: "Asia/Kolkata", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } } },
  { name: "Instagram", type: "url" },
  { name: "PageSpeed Score", type: "number", options: { precision: 0 } },
  { name: "Has Website", type: "checkbox", options: { color: "greenBright", icon: "check" } },
  { name: "Mobile Friendly", type: "checkbox", options: { color: "greenBright", icon: "check" } },
  { name: "HTTPS", type: "checkbox", options: { color: "greenBright", icon: "check" } },
  { name: "Load Time ms", type: "number", options: { precision: 0 } },
  { name: "Biggest Gap", type: "multilineText" },
  { name: "Est Lost Revenue", type: "currency", options: { precision: 0, symbol: "₹" } },
  { name: "Rank Score", type: "number", options: { precision: 0 } },
];

// Cache for table IDs to avoid repeated lookups
const tableCache = new Map<string, string>();

/**
 * List all tables in the base and return a map of name -> table object
 */
async function listTables(pat: string, baseId: string): Promise<Map<string, any>> {
  const res = await fetch(`${AIRTABLE_API_URL}/meta/bases/${baseId}/tables`, {
    headers: getHeaders(pat),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Airtable list tables failed: ${res.status} - ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const map = new Map<string, any>();
  for (const table of data.tables || []) {
    map.set(table.name.toLowerCase(), table);
  }
  return map;
}

/**
 * Create a new table in the base with the lead fields
 */
async function createTable(pat: string, baseId: string, tableName: string): Promise<string> {
  const res = await fetch(`${AIRTABLE_API_URL}/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: getHeaders(pat),
    body: JSON.stringify({
      name: tableName,
      fields: LEAD_TABLE_FIELDS,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Airtable create table failed: ${res.status} - ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log(`[Airtable] Created table "${tableName}" with id ${data.id}`);
  return data.id;
}

/**
 * Ensure a table exists for the given niche. Creates if it doesn't exist.
 * Returns the table name (used in API URL).
 */
async function ensureTableExists(pat: string, baseId: string, niche: string): Promise<string> {
  // Capitalize first letter of each word for table name
  const tableName = niche
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const cacheKey = `${baseId}:${tableName.toLowerCase()}`;

  // Check cache first
  if (tableCache.has(cacheKey)) {
    return tableName;
  }

  try {
    const tables = await listTables(pat, baseId);
    const existingTable = tables.get(tableName.toLowerCase());

    if (existingTable) {
      tableCache.set(cacheKey, existingTable.id);
      
      // Check for missing fields and create them
      const existingFieldNames = new Set((existingTable.fields || []).map((f: any) => f.name));
      const missingFields = LEAD_TABLE_FIELDS.filter((f) => !existingFieldNames.has(f.name));
      
      if (missingFields.length > 0) {
        console.log(`[Airtable] Adding ${missingFields.length} missing fields to "${tableName}"`);
        for (const field of missingFields) {
          try {
            await fetch(`${AIRTABLE_API_URL}/meta/bases/${baseId}/tables/${existingTable.id}/fields`, {
              method: "POST",
              headers: getHeaders(pat),
              body: JSON.stringify(field),
            });
            // Delay to avoid rate limit on metadata API (5 req/sec limit)
            await new Promise(r => setTimeout(r, 220));
          } catch (e) {
            console.error(`[Airtable] Failed to add field ${field.name}:`, e);
          }
        }
      }
      
      return tableName;
    }

    // Table doesn't exist, create it
    const tableId = await createTable(pat, baseId, tableName);
    tableCache.set(cacheKey, tableId);
    return tableName;
  } catch (err) {
    console.error(`[Airtable] ensureTableExists error:`, err);
    throw err;
  }
}

/**
 * Convert a Lead object to Airtable fields
 */
function leadToFields(lead: Lead): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    "Business Name": lead.name || "",
    "Category": lead.category || "",
    "Address": lead.address || "",
    "City": lead.city || "",
    "Scraped At": new Date().toISOString(),
  };

  // Only add optional fields if they have values (Airtable rejects null for typed fields)
  if (lead.phone) fields["Phone"] = lead.phone;
  if (lead.whatsapp) fields["WhatsApp"] = lead.whatsapp;
  if (lead.email) fields["Email"] = lead.email;
  if (lead.website) fields["Website"] = lead.website;
  if (typeof lead.rating === "number") fields["Google Rating"] = lead.rating;
  if (typeof lead.reviewsCount === "number") fields["Reviews Count"] = lead.reviewsCount;
  if (typeof lead.lat === "number") fields["Latitude"] = lead.lat;
  if (typeof lead.lng === "number") fields["Longitude"] = lead.lng;

  return fields;
}

/**
 * Check if a lead with the same Business Name + Address already exists in the table.
 * Returns true if duplicate found.
 */
async function isDuplicate(pat: string, baseId: string, tableName: string, lead: Lead): Promise<boolean> {
  try {
    const filterFormula = `AND({Business Name}="${lead.name.replace(/"/g, '\\"')}",{Address}="${lead.address.replace(/"/g, '\\"')}")`;
    const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const res = await fetch(url, { headers: getHeaders(pat) });
    if (!res.ok) return false; // If check fails, allow the save

    const data = await res.json();
    return (data.records || []).length > 0;
  } catch {
    return false; // On error, allow save (don't block)
  }
}

/**
 * Save a single lead to Airtable.
 * - Auto-creates the table if it doesn't exist (niche = table name)
 * - Skips duplicates (same name + address)
 * - Silently fails on errors (logs but doesn't throw)
 */
export async function saveLeadToAirtable(lead: Lead, niche: string): Promise<{ saved: boolean; error?: string }> {
  const { pat, baseId, isConfigured } = getConfig();

  if (!isConfigured) {
    return { saved: false, error: "Airtable not configured (AIRTABLE_PAT or AIRTABLE_BASE_ID missing)" };
  }

  try {
    // Ensure table exists
    const tableName = await ensureTableExists(pat!, baseId!, niche);

    // Check for duplicates
    const duplicate = await isDuplicate(pat!, baseId!, tableName, lead);
    if (duplicate) {
      console.log(`[Airtable] Skipping duplicate: "${lead.name}" at "${lead.address}"`);
      return { saved: false, error: "Duplicate lead" };
    }

    // Create the record
    const res = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`, {
      method: "POST",
      headers: getHeaders(pat!),
      body: JSON.stringify({
        records: [{ fields: leadToFields(lead) }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${res.status} - ${JSON.stringify(err)}`);
    }

    console.log(`[Airtable] Saved lead: "${lead.name}" to table "${tableName}"`);
    return { saved: true };
  } catch (err: any) {
    console.error(`[Airtable] Save failed for "${lead.name}":`, err.message || err);
    return { saved: false, error: err.message || String(err) };
  }
}

/**
 * Save multiple leads in batch (10 per request — Airtable limit).
 * Returns count of successfully saved leads.
 */
export async function saveLeadsToAirtable(leads: Lead[], niche: string): Promise<{ savedCount: number; errors: string[] }> {
  const { pat, baseId, isConfigured } = getConfig();

  if (!isConfigured) {
    return { savedCount: 0, errors: ["Airtable not configured"] };
  }

  const errors: string[] = [];
  let savedCount = 0;

  try {
    const tableName = await ensureTableExists(pat!, baseId!, niche);

    // Process in batches of 10 (Airtable API limit)
    for (let i = 0; i < leads.length; i += 10) {
      const batch = leads.slice(i, i + 10);
      const records = batch.map((lead) => ({ fields: leadToFields(lead) }));

      try {
        const res = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`, {
          method: "POST",
          headers: getHeaders(pat!),
          body: JSON.stringify({ records }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push(`Batch ${i / 10 + 1}: ${res.status} - ${JSON.stringify(err)}`);
        } else {
          savedCount += batch.length;
          console.log(`[Airtable] Batch saved ${batch.length} leads to "${tableName}"`);
        }
      } catch (err: any) {
        errors.push(`Batch ${i / 10 + 1}: ${err.message}`);
      }

      // Rate limit: wait 220ms between batch requests (5 req/sec max)
      if (i + 10 < leads.length) {
        await new Promise((r) => setTimeout(r, 220));
      }
    }
  } catch (err: any) {
    errors.push(err.message || String(err));
  }

  return { savedCount, errors };
}

/**
 * Get the Airtable record ID for a lead based on Business Name and Address
 */
async function getLeadRecordId(pat: string, baseId: string, tableName: string, lead: Lead): Promise<string | null> {
  try {
    const filterFormula = `AND({Business Name}="${lead.name.replace(/"/g, '\\"')}",{Address}="${lead.address.replace(/"/g, '\\"')}")`;
    const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const res = await fetch(url, { headers: getHeaders(pat) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.records && data.records.length > 0) {
      return data.records[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Update an existing lead in Airtable with Audit and Rank data.
 */
export async function updateLeadInAirtable(
  lead: Lead,
  audit: AuditResult,
  rankScore: number,
  niche: string,
  extra?: { email?: string; phone?: string; instagram?: string }
): Promise<{ updated: boolean; error?: string }> {
  const { pat, baseId, isConfigured } = getConfig();

  if (!isConfigured) {
    return { updated: false, error: "Airtable not configured" };
  }

  try {
    const tableName = await ensureTableExists(pat!, baseId!, niche);
    const recordId = await getLeadRecordId(pat!, baseId!, tableName, lead);

    if (!recordId) {
      console.log(`[Airtable] Record not found for update: "${lead.name}"`);
      return { updated: false, error: "Record not found" };
    }

    const fields: Record<string, unknown> = {
      "PageSpeed Score": audit.pageSpeedScore,
      "Has Website": audit.hasWebsite,
      "Mobile Friendly": audit.mobileFriendly,
      "HTTPS": audit.https,
      "Load Time ms": audit.loadTimeMs,
      "Biggest Gap": audit.biggestGap,
      "Est Lost Revenue": audit.estLostRevenuePerMonth,
      "Rank Score": rankScore,
    };

    if (extra?.email) fields["Email"] = extra.email;
    if (extra?.phone) fields["Phone"] = extra.phone;
    if (extra?.instagram) fields["Instagram"] = extra.instagram;

    const res = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
      method: "PATCH",
      headers: getHeaders(pat!),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${res.status} - ${JSON.stringify(err)}`);
    }

    console.log(`[Airtable] Updated lead: "${lead.name}" with audit & rank data`);
    return { updated: true };
  } catch (err: any) {
    console.error(`[Airtable] Update failed for "${lead.name}":`, err.message || err);
    return { updated: false, error: err.message || String(err) };
  }
}
