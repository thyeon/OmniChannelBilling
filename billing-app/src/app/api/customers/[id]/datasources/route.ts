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
    };
    responseMapping: {
      usageCountPath: string;
      sentPath?: string;
      failedPath?: string;
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

  return {
    valid: true,
    data: {
      type: b.type as DataSourceType,
      serviceType: b.serviceType as ServiceType,
      name: b.name as string,
      apiEndpoint: b.apiEndpoint as string,
      authType: b.authType as AuthType,
      authCredentials: b.authCredentials as {
        key?: string;
        token?: string;
        username?: string;
        password?: string;
      } | undefined,
      responseMapping: {
        usageCountPath: rm.usageCountPath as string,
        sentPath: rm.sentPath as string | undefined,
        failedPath: rm.failedPath as string | undefined,
      },
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
