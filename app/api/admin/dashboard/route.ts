import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { listRecords } from "@/lib/store";

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const [orders, enquiries] = await Promise.all([listRecords("order"), listRecords("custom-order")]);
	return NextResponse.json({ orders, enquiries });
}
