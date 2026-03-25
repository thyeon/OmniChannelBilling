import { NextRequest, NextResponse } from "next/server";
import {
  createDataSource,
  findDataSourcesByCustomerId,
} from "@/infrastructure/db/dataSourceRepository";
import { DataSourceType, AuthType, ServiceType } from "@/domain/models/dataSource";

interface RouteParams {
  params: { id: string };
}

/** Validation helper for DataSource */
function validateDataSourceBody(body: unknown): {
  valid: boolean;
  error?: string;
  data?: {
    type: DataSourceType;
    serviceType: ServiceType;
    name: string;
    apiEndpoint: string;
    authType: AuthType;
    authCredentials?: {
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
    lineItemMappings?: {
      lineIdentifier: string;
      countPath: string;
      ratePath?: string;
      fallbackRate?: number;
    }[];
    requestTemplate?: {
      method: 'GET' | 'POST';
      headers?: Record<string, string>;
      bodyTemplate?: string;
    };
    retryPolicy?: {
      maxRetries: number;
      retryDelaySeconds: number;
      timeoutSeconds: number;
    };
    fallbackValues?: {
      usageCount?: number;
      sentCount?: number;
      failedCount?: number;
      useDefaultOnMissing: boolean;
    };
    isActive: boolean;
  };
} {
  const b = body as Record<string, unknown>;

  if (!b.type || !["COWAY_API", "RECON_SERVER", "CUSTOM_REST_API"].includes(b.type as string)) {
    return { valid: false, error: "Invalid or missing type" };
  }
  if (!b.serviceType || !["SMS", "EMAIL", "WHATSAPP"].includes(b.serviceType as string)) {
    return { valid: false, error: "Invalid or missing serviceType" };
  }
  if (!b.name || typeof b.name !== "string") {
    return { valid: false, error: "Invalid or missing name" };
  }
  if (!b.apiEndpoint || typeof b.apiEndpoint !== "string") {
    return { valid: false, error: "Invalid or missing apiEndpoint" };
  }
  if (!b.authType || !["API_KEY", "BEARER_TOKEN", "BASIC_AUTH", "NONE"].includes(b.authType as string)) {
    return { valid: false, error: "Invalid or missing authType" };
  }
  if (!b.responseMapping || typeof b.responseMapping !== "object") {
    return { valid: false, error: "Invalid or missing responseMapping" };
  }
  const rm = b.responseMapping as Record<string, unknown>;
  if (!rm.usageCountPath || typeof rm.usageCountPath !== "string") {
    return { valid: false, error: "Invalid or missing usageCountPath" };
  }

  // Validate lineItemMappings (optional)
  let lineItemMappings: { lineIdentifier: string; countPath: string; ratePath?: string; fallbackRate?: number }[] | undefined;
  if (b.lineItemMappings !== undefined) {
    if (!Array.isArray(b.lineItemMappings)) {
      return { valid: false, error: "lineItemMappings must be an array" };
    }
    lineItemMappings = [];
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
  }

  // Validate requestTemplate (optional)
  let requestTemplate: { method: 'GET' | 'POST'; headers?: Record<string, string>; bodyTemplate?: string } | undefined;
  if (b.requestTemplate !== undefined) {
    if (typeof b.requestTemplate !== "object") {
      return { valid: false, error: "requestTemplate must be an object" };
    }
    const rt = b.requestTemplate as Record<string, unknown>;
    if (!rt.method || !["GET", "POST"].includes(rt.method as string)) {
      return { valid: false, error: "Invalid method in requestTemplate" };
    }
    requestTemplate = {
      method: rt.method as 'GET' | 'POST',
      headers: rt.headers as Record<string, string> | undefined,
      bodyTemplate: rt.bodyTemplate as string | undefined,
    };
  }

  // Validate retryPolicy (optional)
  let retryPolicy: { maxRetries: number; retryDelaySeconds: number; timeoutSeconds: number } | undefined;
  if (b.retryPolicy !== undefined) {
    if (typeof b.retryPolicy !== "object") {
      return { valid: false, error: "retryPolicy must be an object" };
    }
    const rp = b.retryPolicy as Record<string, unknown>;
    if (typeof rp.maxRetries !== "number" || typeof rp.retryDelaySeconds !== "number" || typeof rp.timeoutSeconds !== "number") {
      return { valid: false, error: "Invalid retryPolicy fields" };
    }
    retryPolicy = {
      maxRetries: rp.maxRetries as number,
      retryDelaySeconds: rp.retryDelaySeconds as number,
      timeoutSeconds: rp.timeoutSeconds as number,
    };
  }

  // Validate fallbackValues (optional)
  let fallbackValues: { usageCount?: number; sentCount?: number; failedCount?: number; useDefaultOnMissing: boolean } | undefined;
  if (b.fallbackValues !== undefined) {
    if (typeof b.fallbackValues !== "object") {
      return { valid: false, error: "fallbackValues must be an object" };
    }
    const fv = b.fallbackValues as Record<string, unknown>;
    if (typeof fv.useDefaultOnMissing !== "boolean") {
      return { valid: false, error: "Invalid useDefaultOnMissing in fallbackValues" };
    }
    fallbackValues = {
      usageCount: fv.usageCount as number | undefined,
      sentCount: fv.sentCount as number | undefined,
      failedCount: fv.failedCount as number | undefined,
      useDefaultOnMissing: fv.useDefaultOnMissing as boolean,
    };
  }

  // Validate authCredentials.headerName (optional)
  const authCredentials = b.authCredentials as Record<string, unknown> | undefined;
  const validatedAuthCredentials = authCredentials ? {
    key: authCredentials.key as string | undefined,
    token: authCredentials.token as string | undefined,
    username: authCredentials.username as string | undefined,
    password: authCredentials.password as string | undefined,
    headerName: authCredentials.headerName as string | undefined,
  } : undefined;

  return {
    valid: true,
    data: {
      type: b.type as DataSourceType,
      serviceType: b.serviceType as ServiceType,
      name: b.name as string,
      apiEndpoint: b.apiEndpoint as string,
      authType: b.authType as AuthType,
      authCredentials: validatedAuthCredentials,
      responseMapping: {
        usageCountPath: rm.usageCountPath as string,
        sentPath: rm.sentPath as string | undefined,
        failedPath: rm.failedPath as string | undefined,
      },
      lineItemMappings,
      requestTemplate,
      retryPolicy,
      fallbackValues,
      isActive: b.isActive !== false,
    },
  };
}

/** GET /api/customers/[id]/datasources — List all data sources for a customer. */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const dataSources = await findDataSourcesByCustomerId(params.id);
    return NextResponse.json({ dataSources });
  } catch (error) {
    console.error("Failed to fetch data sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch data sources" },
      { status: 500 }
    );
  }
}

/** POST /api/customers/[id]/datasources — Create a new data source for a customer. */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validation = validateDataSourceBody(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const dataSource = await createDataSource({
      customerId: params.id,
      ...validation.data!,
    });

    return NextResponse.json({ dataSource }, { status: 201 });
  } catch (error) {
    console.error("Failed to create data source:", error);
    return NextResponse.json(
      { error: "Failed to create data source" },
      { status: 500 }
    );
  }
}
