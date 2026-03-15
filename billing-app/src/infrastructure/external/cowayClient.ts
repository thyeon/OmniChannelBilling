const COWAY_API_URL = process.env.COWAY_API_URL || "https://sms2.g-i.com.my/api/summaryv2";
const COWAY_API_SECRET = process.env.COWAY_API_SECRET || "VpHVSMLS1E4xa2vq7qtVYtb7XJIBDB";
const COWAY_API_USER = process.env.COWAY_API_USER || "gi_xHdw6";
const COWAY_SERVICE_PROVIDER = process.env.COWAY_SERVICE_PROVIDER || "gts";

export interface CowayApiResponse {
  success: boolean;
  total: number;
  successCount: number;
  failed: number;
  notReqToServiceProvider: number;
}

export interface CowayBillableItem {
  source_client_name: string;
  line_items: Array<{
    description: string;
    description_detail: string;
    qty: number;
    unit_price: number;
  }>;
}

/**
 * Convert period (YYYY-MM) to Malaysia timezone date range
 * @param period - Format: "2026-03"
 * @returns { dtFrom: string, dtTo: string } in Malaysia timezone (UTC+8)
 */
function getDateRange(period: string): { dtFrom: string; dtTo: string } {
  const [year, month] = period.split("-").map(Number);

  // Start of month: 1st day at 00:00:00 MYT (UTC+8)
  const dtFrom = `${year}-${String(month).padStart(2, "0")}-01 00:00:00`;

  // End of month: last day at 23:59:59 MYT (UTC+8)
  // Handle leap year for February
  const daysInMonth = new Date(year, month, 0).getDate();
  const dtTo = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")} 23:59:59`;

  return { dtFrom, dtTo };
}

/**
 * Fetch billable data for Coway from Coway API
 * @param period - Format: "2026-03"
 * @returns CowayBillableItem[]
 */
export async function fetchCowayBillable(period: string): Promise<CowayBillableItem[]> {
  const { dtFrom, dtTo } = getDateRange(period);

  const payload = {
    user: COWAY_API_USER,
    secret: COWAY_API_SECRET,
    serviceProvider: COWAY_SERVICE_PROVIDER,
    dtFrom,
    dtTo,
  };

  const response = await fetch(COWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000), // 60 second timeout
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Coway billable data: ${response.status} - ${error}`);
  }

  const data: CowayApiResponse = await response.json();

  if (!data.success) {
    throw new Error(`Coway API returned success: false`);
  }

  // Return as array with single item - the MongoDB config will be merged later
  // For now, return the raw total count; the service layer will merge with MongoDB config
  return [{
    source_client_name: "Coway (Malaysia) Sdn Bhd",
    line_items: [{
      description: "",  // Will be populated from MongoDB template
      description_detail: "",  // Will be populated from MongoDB template
      qty: data.total,
      unit_price: 0,  // Will be populated from MongoDB rates
    }],
  }];
}
