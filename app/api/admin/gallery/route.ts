import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { uploadMedia } from "@/lib/r2";

export async function POST(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const form = await request.formData();
	const urls: string[] = [];
	try {
		for (const entry of form.getAll("files")) {
			if (!(entry instanceof File) || entry.size === 0) continue;
			if (!entry.type.startsWith("image/") || entry.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
			urls.push(await uploadMedia(`gallery/${Date.now()}-${urls.length}-${entry.name}`, new Uint8Array(await entry.arrayBuffer()), entry.type));
		}
		return NextResponse.json({ urls });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload photos" }, { status: 503 });
	}
}
