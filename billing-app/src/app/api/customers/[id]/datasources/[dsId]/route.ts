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
    };
    responseMapping: {
      usageCountPath: string;
      sentPath?: string;
      failedPath?: string;
    };
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
