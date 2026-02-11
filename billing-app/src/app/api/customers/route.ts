import { NextRequest, NextResponse } from "next/server";
import {
  findAllCustomers,
  insertCustomer,
} from "@/infrastructure/db/customerRepository";

/** GET /api/customers — Fetch all customers. */
export async function GET(): Promise<NextResponse> {
  try {
    const customers = await findAllCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

/** POST /api/customers — Create a new customer. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const customer = await insertCustomer(body);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
