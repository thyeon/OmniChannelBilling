import { NextRequest, NextResponse } from "next/server";
import {
  findDataSourceById,
  updateDataSource,
  deleteDataSource,
} from "@/infrastructure/db/dataSourceRepository";
import { DataSourceType, AuthType, ServiceType } from "@/domain/models/dataSource";

interface RouteParams {
  params: {
    id: string;
    dsId: string;
  };
}

/** Validation helper for DataSource updates */
function validateDataSourceUpdate(body: unknown): {
  valid: boolean;
  error?: string;
  data?: Partial<{
    type: DataSourceType;
    serviceType: ServiceType;
    name: string;
    apiEndpoint: string;
    authType: AuthType;
    authCredentials: {
      key?: string;
      token?: string;
      username?: string;
      password?: string;
      headerName?: string;
    };
    responseMapping: {
      usageCountPath: string;
      sentPath?: string;
      failedPath?: string;
    };
    lineItemMappings: {
      lineIdentifier: string;
      countPath: string;
      ratePath?: string;
      fallbackRate?: number;
    }[];
    requestTemplate: {
      method: 'GET' | 'POST';
      headers?: Record<string, string>;
      bodyTemplate?: string;
    };
    retryPolicy: {
      maxRetries: number;
      retryDelaySeconds: number;
      timeoutSeconds: number;
    };
    fallbackValues: {
      usageCount?: number;
      sentCount?: number;
      failedCount?: number;
      useDefaultOnMissing: boolean;
    };
    nestedResponseConfig: {
      itemsPath: string;
      lineItemsPath: string;
      descriptionPath: string;
      descriptionDetailPath?: string;
      qtyPath: string;
      unitPricePath: string;
      servicePath?: string;
    };
    sourceClientId: string;
    isActive: boolean;
  }>;
} {
  const b = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};

  if (b.type !== undefined) {
    if (!["COWAY_API", "RECON_SERVER", "CUSTOM_REST_API"].includes(b.type as string)) {
      return { valid: false, error: "Invalid type" };
    }
    updateData.type = b.type;
  }

  if (b.serviceType !== undefined) {
    if (!["SMS", "EMAIL", "WHATSAPP"].includes(b.serviceType as string)) {
      return { valid: false, error: "Invalid serviceType" };
    }
    updateData.serviceType = b.serviceType;
  }

  if (b.name !== undefined) {
    if (typeof b.name !== "string") {
      return { valid: false, error: "Invalid name" };
    }
    updateData.name = b.name;
  }

  if (b.apiEndpoint !== undefined) {
    if (typeof b.apiEndpoint !== "string") {
      return { valid: false, error: "Invalid apiEndpoint" };
    }
    updateData.apiEndpoint = b.apiEndpoint;
  }

  if (b.authType !== undefined) {
    if (!["API_KEY", "BEARER_TOKEN", "BASIC_AUTH", "NONE"].includes(b.authType as string)) {
      return { valid: false, error: "Invalid authType" };
    }
    updateData.authType = b.authType;
  }

  if (b.authCredentials !== undefined) {
    if (typeof b.authCredentials !== "object") {
      return { valid: false, error: "Invalid authCredentials" };
    }
    updateData.authCredentials = b.authCredentials;
  }

  if (b.responseMapping !== undefined) {
    if (typeof b.responseMapping !== "object") {
      return { valid: false, error: "Invalid responseMapping" };
    }
    const rm = b.responseMapping as Record<string, unknown>;
    if (rm.usageCountPath !== undefined) {
      if (typeof rm.usageCountPath !== "string") {
        return { valid: false, error: "Invalid usageCountPath" };
      }
      if (!updateData.responseMapping) {
        updateData.responseMapping = {};
      }
      (updateData.responseMapping as Record<string, unknown>).usageCountPath = rm.usageCountPath;
    }
    if (rm.sentPath !== undefined) {
      if (!updateData.responseMapping) {
        updateData.responseMapping = {};
      }
      (updateData.responseMapping as Record<string, unknown>).sentPath = rm.sentPath;
    }
    if (rm.failedPath !== undefined) {
      if (!updateData.responseMapping) {
        updateData.responseMapping = {};
      }
      (updateData.responseMapping as Record<string, unknown>).failedPath = rm.failedPath;
    }
  }

  // Validate nestedResponseConfig (optional)
  if (b.nestedResponseConfig !== undefined) {
    if (typeof b.nestedResponseConfig !== "object") {
      return { valid: false, error: "nestedResponseConfig must be an object" };
    }
    const nc = b.nestedResponseConfig as Record<string, unknown>;
    if (typeof nc.itemsPath !== "string") return { valid: false, error: "nestedResponseConfig.itemsPath required" };
    if (typeof nc.lineItemsPath !== "string") return { valid: false, error: "nestedResponseConfig.lineItemsPath required" };
    if (typeof nc.descriptionPath !== "string") return { valid: false, error: "nestedResponseConfig.descriptionPath required" };
    if (typeof nc.qtyPath !== "string") return { valid: false, error: "nestedResponseConfig.qtyPath required" };
    if (typeof nc.unitPricePath !== "string") return { valid: false, error: "nestedResponseConfig.unitPricePath required" };
    updateData.nestedResponseConfig = {
      itemsPath: nc.itemsPath as string,
      lineItemsPath: nc.lineItemsPath as string,
      descriptionPath: nc.descriptionPath as string,
      descriptionDetailPath: nc.descriptionDetailPath as string | undefined,
      qtyPath: nc.qtyPath as string,
      unitPricePath: nc.unitPricePath as string,
      servicePath: nc.servicePath as string | undefined,
    };
  }

  // Validate sourceClientId (optional)
  if (b.sourceClientId !== undefined && typeof b.sourceClientId !== "string") {
    return { valid: false, error: "sourceClientId must be a string" };
  }
  if (b.sourceClientId !== undefined) {
    updateData.sourceClientId = b.sourceClientId;
  }

  // Validate lineItemMappings (optional)
  if (b.lineItemMappings !== undefined) {
    if (!Array.isArray(b.lineItemMappings)) {
      return { valid: false, error: "lineItemMappings must be an array" };
    }
    const lineItemMappings: { lineIdentifier: string; countPath: string; ratePath?: string; fallbackRate?: number }[] = [];
    for (const item of b.lineItemMappings as Record<string, unknown>[]) {
      if (!item.lineIdentifier || typeof item.lineIdentifier !== "string") {
        return { valid: false, error: "Invalid lineIdentifier in lineItemMappings" };
      }
      if (!item.countPath || typeof item.countPath !== "string") {
        return { valid: false, error: "Invalid countPath in lineItemMappings" };
      }
      lineItemMappings.push({
        lineIdentifier: item.lineIdentifier as string,
        countPath: item.countPath as string,
        ratePath: item.ratePath as string | undefined,
        fallbackRate: item.fallbackRate as number | undefined,
      });
    }
    updateData.lineItemMappings = lineItemMappings;
  }

  // Validate requestTemplate (optional)
  if (b.requestTemplate !== undefined) {
    if (typeof b.requestTemplate !== "object") {
      return { valid: false, error: "requestTemplate must be an object" };
    }
    const rt = b.requestTemplate as Record<string, unknown>;
    if (!rt.method || !["GET", "POST"].includes(rt.method as string)) {
      return { valid: false, error: "Invalid method in requestTemplate" };
    }
    updateData.requestTemplate = {
      method: rt.method as 'GET' | 'POST',
      headers: rt.headers as Record<string, string> | undefined,
      bodyTemplate: rt.bodyTemplate as string | undefined,
    };
  }

  // Validate retryPolicy (optional)
  if (b.retryPolicy !== undefined) {
    if (typeof b.retryPolicy !== "object") {
      return { valid: false, error: "retryPolicy must be an object" };
    }
    const rp = b.retryPolicy as Record<string, unknown>;
    if (typeof rp.maxRetries !== "number" || typeof rp.retryDelaySeconds !== "number" || typeof rp.timeoutSeconds !== "number") {
      return { valid: false, error: "Invalid retryPolicy fields" };
    }
    updateData.retryPolicy = {
      maxRetries: rp.maxRetries as number,
      retryDelaySeconds: rp.retryDelaySeconds as number,
      timeoutSeconds: rp.timeoutSeconds as number,
    };
  }

  // Validate fallbackValues (optional)
  if (b.fallbackValues !== undefined) {
    if (typeof b.fallbackValues !== "object") {
      return { valid: false, error: "fallbackValues must be an object" };
    }
    const fv = b.fallbackValues as Record<string, unknown>;
    if (typeof fv.useDefaultOnMissing !== "boolean") {
      return { valid: false, error: "Invalid useDefaultOnMissing in fallbackValues" };
    }
    updateData.fallbackValues = {
      usageCount: fv.usageCount as number | undefined,
      sentCount: fv.sentCount as number | undefined,
      failedCount: fv.failedCount as number | undefined,
      useDefaultOnMissing: fv.useDefaultOnMissing as boolean,
    };
  }

  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") {
      return { valid: false, error: "Invalid isActive" };
    }
    updateData.isActive = b.isActive;
  }

  return { valid: true, data: updateData as typeof updateData extends never ? never : typeof updateData };
}

/** GET /api/customers/[id]/datasources/[dsId] — Fetch a single data source. */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const dataSource = await findDataSourceById(params.dsId);
    if (!dataSource) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }
    // Ensure the data source belongs to this customer
    if (dataSource.customerId !== params.id) {
      return NextResponse.json(
        { error: "Data source does not belong to this customer" },
        { status: 403 }
      );
    }
    return NextResponse.json({ dataSource });
  } catch (error) {
    console.error("Failed to fetch data source:", error);
    return NextResponse.json(
      { error: "Failed to fetch data source" },
      { status: 500 }
    );
  }
}

/** PUT /api/customers/[id]/datasources/[dsId] — Update a data source. */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validation = validateDataSourceUpdate(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // First check the data source exists and belongs to this customer
    const existing = await findDataSourceById(params.dsId);
    if (!existing) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }
    if (existing.customerId !== params.id) {
      return NextResponse.json(
        { error: "Data source does not belong to this customer" },
        { status: 403 }
      );
    }

    const updated = await updateDataSource(params.dsId, validation.data as Parameters<typeof updateDataSource>[1]);
    return NextResponse.json({ dataSource: updated });
  } catch (error) {
    console.error("Failed to update data source:", error);
    return NextResponse.json(
      { error: "Failed to update data source" },
      { status: 500 }
    );
  }
}

/** DELETE /api/customers/[id]/datasources/[dsId] — Delete a data source. */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // First check the data source exists and belongs to this customer
    const existing = await findDataSourceById(params.dsId);
    if (!existing) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }
    if (existing.customerId !== params.id) {
      return NextResponse.json(
        { error: "Data source does not belong to this customer" },
        { status: 403 }
      );
    }

    const deleted = await deleteDataSource(params.dsId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete data source" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete data source:", error);
    return NextResponse.json(
      { error: "Failed to delete data source" },
      { status: 500 }
    );
  }
}
