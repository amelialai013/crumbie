import { NextResponse } from "next/server";
import { getRecord, setRecord } from "@/lib/store";
import { isAdmin } from "@/lib/session";

const editableModules = new Set([
	"homepage",
	"about",
	"contact us",
	"policy",
	"email templates",
	"settings",
]);
const limits: Record<string, Record<string, number>> = {
	homepage: { heroPrimaryLabel: 40, heroSecondaryLabel: 40, howTitle: 80, stepOneTitle: 60, stepOneBody: 180, stepTwoTitle: 60, stepTwoBody: 180, stepThreeTitle: 60, stepThreeBody: 180, catalogHeading: 100 },
	about: { pageTitle: 80, storyHeading: 80, storyCopy: 1200, batchHeading: 80, batchCopy: 800 },
	"contact us": { pageTitle: 80, messagePrompt: 180 },
	policy: { pageTitle: 80, pickupHeading: 80, pickupCopy: 1000, deadlineHeading: 80, deadlineCopy: 700, paymentHeading: 80, paymentCopy: 700, cancellationHeading: 80, cancellationCopy: 1000, allergenHeading: 80, allergenCopy: 700, enquiryHeading: 80, enquiryCopy: 700 },
	"email templates": { confirmationSubject: 140, confirmationBody: 3000, pickupReminderSubject: 140, pickupReminderBody: 3000, enquirySubject: 140, enquiryBody: 3000 },
	settings: { pickupAddress: 240, notificationEmail: 200, businessName: 100 },
};

function validModule(value: unknown): value is string {
	return typeof value === "string" && editableModules.has(value);
}

export async function GET(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const moduleName = new URL(request.url).searchParams.get("module");
	if (!validModule(moduleName)) return NextResponse.json({ error: "Unknown content module" }, { status: 400 });
	return NextResponse.json((await getRecord<{ fields: Record<string, string> }>("content", moduleName)) || { fields: {} });
}

export async function PUT(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const payload = await request.json().catch(() => null);
	if (!payload || !validModule(payload.module) || !payload.fields || typeof payload.fields !== "object" || Array.isArray(payload.fields)) {
		return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
	}
	const moduleLimits = limits[payload.module];
	if (Object.entries(payload.fields).some(([field, value]) => typeof value !== "string" || !(field in moduleLimits) || value.length > moduleLimits[field])) {
		return NextResponse.json({ error: "Content exceeds the character limit" }, { status: 413 });
	}
	if (payload.module !== "policy" && payload.sections !== undefined) return NextResponse.json({ error: "Sections are only supported for policy content" }, { status: 400 });
	if (payload.removedFields !== undefined && (payload.module !== "policy" || !Array.isArray(payload.removedFields) || payload.removedFields.some((field: unknown) => !["allergenHeading", "allergenCopy", "enquiryHeading", "enquiryCopy"].includes(String(field))))) {
		return NextResponse.json({ error: "Invalid removable policy sections" }, { status: 400 });
	}
	if (payload.module === "policy" && payload.sections !== undefined && (!Array.isArray(payload.sections) || payload.sections.some((section: unknown) => {
		if (!section || typeof section !== "object") return true;
		const item = section as { heading?: unknown; body?: unknown };
		return typeof item.heading !== "string" || typeof item.body !== "string" || item.heading.length > 80 || item.body.length > 1000;
	}))) return NextResponse.json({ error: "Policy sections exceed the character limits" }, { status: 413 });
	try {
		await setRecord("content", payload.module, { fields: Object.fromEntries(Object.entries(payload.fields).map(([field, value]) => [field, (value as string).trim()])), ...(payload.module === "policy" ? { sections: (payload.sections || []).map((section: { heading: string; body: string }) => ({ heading: section.heading.trim(), body: section.body.trim() })), removedFields: payload.removedFields || [] } : {}) });
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save content";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}