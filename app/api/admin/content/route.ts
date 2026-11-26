import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRecord, setRecord } from "@/lib/store";
import { isAdmin } from "@/lib/session";
import { policyBodyMaxChars } from "@/lib/text-limits";
import { termsLimits } from "@/lib/terms";
import { privacyLimits } from "@/lib/privacy";

const editableModules = new Set([
	"homepage",
	"about",
	"contact us",
	"faqs",
	"terms of service",
	"privacy policy",
	"order confirmation",
	"newsletter confirmed",
	"email templates",
	"settings",
]);
const limits: Record<string, Record<string, number>> = {
	homepage: { heroPrimaryLabel: 40, heroSecondaryLabel: 40, howTitle: 40, stepOneTitle: 60, stepOneBody: 80, stepTwoTitle: 60, stepTwoBody: 80, stepThreeTitle: 60, stepThreeBody: 80, catalogHeading: 80, newsletterHeading: 60, newsletterBody: 120, newsletterWordTwo: 30, newsletterWordThree: 30, newsletterWordFour: 30, newsletterButton: 24, newsletterNote: 80, newsletterDoneTitle: 40, newsletterDoneBody: 120 },
	about: { pageTitle: 80, storyHeading: 80, storyCopy: 1200, batchHeading: 80, batchCopy: 800 },
	"contact us": { pageTitle: 80, messagePrompt: 180, enquiryTypes: 1000 },
	faqs: { pageTitle: 80, pickupHeading: 80, pickupCopy: policyBodyMaxChars, deadlineHeading: 80, deadlineCopy: policyBodyMaxChars, paymentHeading: 80, paymentCopy: policyBodyMaxChars, cancellationHeading: 80, cancellationCopy: policyBodyMaxChars, allergenHeading: 80, allergenCopy: policyBodyMaxChars, enquiryHeading: 80, enquiryCopy: policyBodyMaxChars },
	"terms of service": termsLimits,
	"privacy policy": privacyLimits,
	"order confirmation": { pageTitle: 80, message: 600, buttonLabel: 40 },
	"newsletter confirmed": { pageTitle: 80, message: 300, buttonLabel: 40 },
	"email templates": { confirmationSubject: 140, confirmationBody: 3000, pickupReminderSubject: 140, pickupReminderBody: 3000, enquirySubject: 140, enquiryBody: 3000, subscribeSubject: 140, subscribeHeading: 100, subscribeBody: 600, subscribeButtonLabel: 40, subscribeFooter: 200, welcomeSubject: 140, welcomeBody: 3000, welcomeButtonLabel: 60, welcomeButtonUrl: 300, welcomeDiscountEnabled: 5, welcomeDiscountType: 10, welcomeDiscountValue: 8 },
	settings: { pickupAddress: 240, notificationEmail: 200, businessName: 100, cardEnabled: 5, cardPrice: 8, cardLabel: 60, cardDescription: 200, cardNamePlaceholder: 120, cardNameMaxLength: 2, cardMessageMaxLength: 3, cardMessagePlaceholder: 160, galleryTitle: 80, galleryBody: 300, galleryImages: 8000, searchImage: 600, heroImage: 600, promoEnabled: 5, promoProductId: 120, promoLabel: 40, promoHeadline: 60, promoBlurb: 120, promoButton: 24, promoLanding: 5, promoLayout: 10, landingProductId: 120, countdownEnabled: 5, countdownDate: 10, countdownTime: 5, countdownLabel: 60, countdownNextProductId: 80, promoPill: 40, promoList: 600, promoCardLabel: 60, promoCardPrice: 8, promoCardDescription: 200, exploreTitle: 60, exploreSubtext: 160, customTitle: 80, customSubtext: 160, customButton: 30, customLink: 200, unavailableMessage: 200, deliverableMessage: 200, undeliverableMessage: 200, addressErrorMessage: 200, deliveryEnabled: 5, deliveryFee: 8, pickupFee: 8, deliveryFreeOver: 8, deliveryPostcodes: 20000, deliveryRadiusKm: 3, deliveryInfo: 200, pickupTitle: 30, pickupDescription: 80, deliveryTitle: 30, deliveryDescription: 80 },
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
	if (payload.module === "settings") payload.fields = Object.fromEntries(Object.entries(payload.fields).filter(([field]) => field in moduleLimits));
	if (Object.entries(payload.fields).some(([field, value]) => typeof value !== "string" || !(field in moduleLimits) || value.length > moduleLimits[field])) {
		return NextResponse.json({ error: "Content exceeds the character limit" }, { status: 413 });
	}
	if (payload.module === "faqs" && Object.entries(payload.fields).some(([field, value]) => field.endsWith("Copy") && (value as string).length > policyBodyMaxChars)) {
		return NextResponse.json({ error: `Answers are limited to ${policyBodyMaxChars} characters` }, { status: 413 });
	}
	if (payload.module !== "faqs" && payload.sections !== undefined) return NextResponse.json({ error: "Extra questions are only supported for FAQs" }, { status: 400 });
	if (payload.removedFields !== undefined && (payload.module !== "faqs" || !Array.isArray(payload.removedFields) || payload.removedFields.some((field: unknown) => !["allergenHeading", "allergenCopy", "enquiryHeading", "enquiryCopy"].includes(String(field))))) {
		return NextResponse.json({ error: "Invalid removable questions" }, { status: 400 });
	}
	if (payload.module === "faqs" && payload.sections !== undefined && (!Array.isArray(payload.sections) || payload.sections.some((section: unknown) => {
		if (!section || typeof section !== "object") return true;
		const item = section as { heading?: unknown; body?: unknown };
		return typeof item.heading !== "string" || typeof item.body !== "string" || item.heading.length > 80 || item.body.length > policyBodyMaxChars;
	}))) return NextResponse.json({ error: "Extra questions exceed the character limits" }, { status: 413 });
	try {
		await setRecord("content", payload.module, { fields: Object.fromEntries(Object.entries(payload.fields).map(([field, value]) => [field, (value as string).trim()])), ...(payload.module === "faqs" ? { sections: (payload.sections || []).map((section: { heading: string; body: string }) => ({ heading: section.heading.trim(), body: section.body.trim() })), removedFields: payload.removedFields || [] } : {}) });
		revalidatePath("/", "layout");
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save content";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}