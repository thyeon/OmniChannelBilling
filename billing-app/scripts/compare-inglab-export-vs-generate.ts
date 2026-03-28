/**
 * Comparison Script: Export (bulk) vs Generate Invoice (per-customer)
 *
 * Run: npx tsx scripts/compare-inglab-export-vs-generate.ts
 *
 * Compares INGLAB API responses between:
 *   Old flow:  GET /billable?period={period}        (bulk, filters by source_client_name)
 *   New flow:  GET /billable?period={period}&client_id={clientId}  (per-customer)
 *
 * Both should return identical line_items data per client.
 */

const BASE_URL = "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB";
const API_TOKEN = process.env.AUTOCOUNT_API_TOKEN || "bda81890-f098-4998-85a8-358a2aeb6de1";

interface IngLabLineItem {
  description: string;
  description_detail: string;
  qty: number | null;
  unit_price: number;
}

interface IngLabBillableItem {
  source_client_name: string;
  line_items: IngLabLineItem[];
}

// Old flow: bulk fetch, filter by source_client_name
async function fetchBulk(period: string, clientName: string): Promise<IngLabLineItem[]> {
  const response = await fetch(`${BASE_URL}/billable?period=${period}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Bulk fetch failed: ${response.status}`);
  const data = await response.json();
  const items: IngLabBillableItem[] = data.items || [];
  const client = items.find((i: IngLabBillableItem) => i.source_client_name === clientName);
  return client?.line_items || [];
}

// New flow: per-customer fetch with source_client_name
async function fetchPerCustomer(period: string, clientId: string): Promise<IngLabLineItem[]> {
  const response = await fetch(`${BASE_URL}/billable?period=${period}&source_client_name=${encodeURIComponent(clientId)}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Per-customer fetch failed: ${response.status}`);
  const data = await response.json();
  const items: IngLabBillableItem[] = data.items || [];
  return items.flatMap((i: IngLabBillableItem) => i.line_items) || [];
}

function compareLineItems(
  clientName: string,
  bulkItems: IngLabLineItem[],
  perCustomerItems: IngLabLineItem[]
): { matches: boolean; differences: string[] } {
  const differences: string[] = [];

  if (bulkItems.length !== perCustomerItems.length) {
    differences.push(
      `Row count: bulk=${bulkItems.length}, per-customer=${perCustomerItems.length}`
    );
  }

  const maxLen = Math.max(bulkItems.length, perCustomerItems.length);
  for (let i = 0; i < maxLen; i++) {
    const bulk = bulkItems[i];
    const pc = perCustomerItems[i];
    if (!bulk && pc) {
      differences.push(`Row ${i}: missing in bulk`);
      continue;
    }
    if (bulk && !pc) {
      differences.push(`Row ${i}: missing in per-customer`);
      continue;
    }
    if (bulk.qty !== pc.qty) {
      differences.push(`Row ${i} qty: bulk=${bulk.qty}, per-customer=${pc.qty}`);
    }
    if (bulk.unit_price !== pc.unit_price) {
      differences.push(`Row ${i} unit_price: bulk=${bulk.unit_price}, per-customer=${pc.unit_price}`);
    }
    if (bulk.description !== pc.description) {
      differences.push(`Row ${i} description: bulk="${bulk.description}", per-customer="${pc.description}"`);
    }
    if (bulk.description_detail !== pc.description_detail) {
      differences.push(`Row ${i} description_detail: bulk="${bulk.description_detail}", per-customer="${pc.description_detail}"`);
    }
  }

  return { matches: differences.length === 0, differences };
}

const CLIENTS = [
  { name: "AIA Malaysia", clientId: "AIA Malaysia" },
  { name: "Zurich Malaysia", clientId: "Zurich Malaysia" },
];

const PERIOD = process.argv[2] || "2026-03";

async function main() {
  console.log(`\n🔍 INGLAB API Comparison: Export (bulk) vs Generate (per-customer)`);
  console.log(`Period: ${PERIOD}\n`);
  console.log("=".repeat(70));

  let allMatch = true;

  for (const client of CLIENTS) {
    console.log(`\n📋 ${client.name} (${client.clientId})`);

    let bulkItems: IngLabLineItem[] = [];
    let pcItems: IngLabLineItem[] = [];

    try {
      [bulkItems, pcItems] = await Promise.all([
        fetchBulk(PERIOD, client.name),
        fetchPerCustomer(PERIOD, client.clientId),
      ]);
    } catch (err) {
      console.log(`   ❌ API call failed: ${(err as Error).message}`);
      allMatch = false;
      continue;
    }

    console.log(`   Bulk (${bulkItems.length} rows):`);
    bulkItems.forEach((item, i) => {
      console.log(`     [${i}] ${item.description} | qty=${item.qty} | price=${item.unit_price}`);
    });

    console.log(`   Per-customer (${pcItems.length} rows):`);
    pcItems.forEach((item, i) => {
      console.log(`     [${i}] ${item.description} | qty=${item.qty} | price=${item.unit_price}`);
    });

    const { matches, differences } = compareLineItems(client.name, bulkItems, pcItems);

    if (matches) {
      console.log(`   ✅ MATCH — bulk and per-customer return identical data`);
    } else {
      console.log(`   ❌ MISMATCH:`);
      differences.forEach((d) => console.log(`      - ${d}`));
      allMatch = false;
    }
  }

  console.log("\n" + "=".repeat(70));
  if (allMatch) {
    console.log("✅ All clients: Export (bulk) matches Generate (per-customer)");
  } else {
    console.log("❌ Some clients have mismatches — see above");
  }

  process.exit(allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Script failed:", err);
  process.exit(1);
});
