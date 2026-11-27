import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { uploadMedia } from "@/lib/r2";
import { siteUrl } from "@/lib/site";

export async function POST(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const form = await request.formData();
	const urls: string[] = [];
	try {
		for (const entry of form.getAll("files")) {
			if (!(entry instanceof File) || entry.size === 0) continue;
			if (!/^image\/(jpeg|png|gif|webp)$/.test(entry.type) || entry.size > 8 * 1024 * 1024) {
				return NextResponse.json({ error: "Use JPG, PNG, GIF or WebP images under 8MB." }, { status: 400 });
			}
			const url = await uploadMedia(`newsletter/${Date.now()}-${urls.length}-${entry.name}`, new Uint8Array(await entry.arrayBuffer()), entry.type);
			urls.push(url.startsWith("/") ? `${siteUrl}${url}` : url);
		}
		return NextResponse.json({ urls });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload images." }, { status: 503 });
	}
}
