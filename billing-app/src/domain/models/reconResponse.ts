/** Raw response from a Reconciliation Server API (e.g. Ali SMS2). */
export interface ReconApiResponse {
  success: boolean;
  total: number;
  successCount: number;
  failed: number;
  notReqToServiceProvider: number;
}

/** Raw response from an Email Reconciliation Server API. */
export interface EmailReconApiResponse {
  count: number;
  message?: string;
}

/** Mapped recon data aligned with the app's internal UsageData shape. */
export interface MappedReconData {
  reconTotal: number;
  reconDetails: {
    sent: number;
    failed: number;
    withheld: number;
  };
}
