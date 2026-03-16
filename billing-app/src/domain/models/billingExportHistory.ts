export interface BillingExportHistory {
  id?: string;
  period: string;
  client_name: string;
  status: "success" | "failed";
  row_count: number;
  file_path?: string;
  error_message?: string;
  exported_at?: Date;
}
