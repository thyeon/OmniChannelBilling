const BASE_URL = process.env.AUTOCOUNT_BASE_URL || "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB";
const API_TOKEN = process.env.AUTOCOUNT_API_TOKEN || "bda81890-f098-4998-85a8-358a2aeb6de1";

export interface IngLabClient {
  id: string;
  source_client_name: string;
  // Add other fields as needed from the API response
}

export interface IngLabBillableItem {
  source_client_name: string;
  line_items: Array<{
    description: string;
    description_detail: string;
    qty: number | null;
    unit_price: number;
  }>;
}

export interface IngLabBillableResponse {
  items: IngLabBillableItem[];
}

/** Fetch all clients from INGLAB Partner API */
export async function fetchIngLabClients(): Promise<IngLabClient[]> {
  const response = await fetch(`${BASE_URL}/clients`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch INGLAB clients: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.clients || data || [];
}

/** Fetch billable data for a specific period from INGLAB Partner API */
export async function fetchIngLabBillable(period: string): Promise<IngLabBillableItem[]> {
  const response = await fetch(`${BASE_URL}/billable?period=${period}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch INGLAB billable data: ${response.status} - ${error}`);
  }

  const data: IngLabBillableResponse = await response.json();
  return data.items || [];
}
