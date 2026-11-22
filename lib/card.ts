export type CardOption = { enabled: boolean; price: number; label: string; description: string; namePlaceholder: string; messagePlaceholder: string; nameMaxLength: number; messageMaxLength: number };

export const defaultCardOption: CardOption = {
	enabled: true,
	price: 3,
	label: "Club Crumbie Card",
	description: "Add a card to go inside your Club Crumbie box, so you can leave someone special with a surprise crumb.",
	namePlaceholder: "Full name (the box recipient or your own, shown on the outside of the box)",
	messagePlaceholder: "Write a little something to go on your card (leave blank for a blank card)",
	nameMaxLength: 30,
	messageMaxLength: 300,
};

// Card settings live in the "settings" content module as strings.
export function cardOptionFrom(fields: Record<string, string> | undefined): CardOption {
	const price = Number(fields?.cardPrice);
	return {
		enabled: fields?.cardEnabled !== "false",
		// Unset uses the default; a saved blank means the card is free.
		price: fields?.cardPrice === undefined ? defaultCardOption.price : fields.cardPrice.trim() && Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0,
		label: fields?.cardLabel?.trim() || defaultCardOption.label,
		// Unset uses the default; a saved blank hides the description.
		namePlaceholder: fields?.cardNamePlaceholder === undefined ? defaultCardOption.namePlaceholder : fields.cardNamePlaceholder.trim(),
		messagePlaceholder: fields?.cardMessagePlaceholder === undefined ? defaultCardOption.messagePlaceholder : fields.cardMessagePlaceholder.trim(),
		nameMaxLength: Math.min(60, Math.max(5, Math.round(Number(fields?.cardNameMaxLength)) || defaultCardOption.nameMaxLength)),
		messageMaxLength: Math.min(500, Math.max(20, Math.round(Number(fields?.cardMessageMaxLength)) || defaultCardOption.messageMaxLength)),
		description: fields?.cardDescription === undefined ? defaultCardOption.description : fields.cardDescription.trim(),
	};
}

export const defaultGalleryCopy = {
	title: "Packed with care, left with love",
	body: "Each box is lined with our tissue, filled with fresh cookies, and finished with a Club Crumbie Card if you'd like to leave someone a crumb.",
};

export function galleryCopyFrom(fields: Record<string, string> | undefined) {
	return {
		title: fields?.galleryTitle?.trim() || defaultGalleryCopy.title,
		body: fields?.galleryBody?.trim() || defaultGalleryCopy.body,
	};
}

// Shared product-page gallery: a JSON array of image URLs stored in the settings module.
export function galleryImagesFrom(fields: Record<string, string> | undefined): string[] {
	try {
		const parsed = JSON.parse(fields?.galleryImages || "[]");
		return Array.isArray(parsed) ? parsed.filter((image): image is string => typeof image === "string" && image.length > 0) : [];
	} catch {
		return [];
	}
}

export type Promo = { productId: string; label: string; headline: string; blurb: string; button: string; cardLabel: string; cardDescription: string; cardPrice: number; landing: boolean; layout: "collage" | "split" | "triptych"; pill: string; items: string[] };

// Crumbs-page promo banner, stored in the "settings" content module.
export function promoFrom(fields: Record<string, string> | undefined): Promo | null {
	if (fields?.promoEnabled !== "true" || !fields.promoProductId) return null;
	return {
		productId: fields.promoProductId,
		label: fields.promoLabel?.trim() ?? "Limited season",
		headline: fields.promoHeadline?.trim() ?? "",
		blurb: fields.promoBlurb?.trim() ?? "",
		button: fields.promoButton?.trim() || "Order now",
		cardLabel: fields.promoCardLabel?.trim() ?? "",
		cardDescription: fields.promoCardDescription?.trim() ?? "",
		landing: fields.promoLanding !== "false",
		pill: fields.promoPill?.trim() ?? "Pickup in Ivanhoe",
		layout: fields.promoLayout === "split" || fields.promoLayout === "triptych" ? fields.promoLayout : "collage",
		items: (fields.promoList ?? "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12),
		// Leaving the hero card price empty makes the card free.
		cardPrice: Number.isFinite(Number(fields.promoCardPrice)) && Number(fields.promoCardPrice) > 0 ? Math.round(Number(fields.promoCardPrice) * 100) / 100 : 0,
	};
}

// Landing-page hero settings; the product defaults to the hero product when none is chosen.
export function landingFrom(fields: Record<string, string> | undefined) {
	const promo = promoFrom(fields);
	return {
		productId: fields?.landingProductId || promo?.productId || "",
		enabled: fields?.promoLanding !== "false",
		layout: fields?.promoLayout === "split" || fields?.promoLayout === "triptych" ? fields.promoLayout : ("collage" as Promo["layout"]),
		pill: fields?.promoPill?.trim() ?? "Pickup in Ivanhoe",
		items: (fields?.promoList ?? "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12),
		promo,
	};
}

// Countdown under the Simple logo hero. Date and time are Melbourne wall-clock.
export function countdownFrom(fields: Record<string, string> | undefined) {
	const date = fields?.countdownDate ?? "";
	const time = /^\d{2}:\d{2}$/.test(fields?.countdownTime ?? "") ? fields!.countdownTime : "00:00";
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	let target = 0;
	if (match) {
		const [hour, minute] = time.split(":").map(Number);
		const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute);
		const shown = new Date(guess).toLocaleString("en-US", { timeZone: "Australia/Melbourne", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
		const [m, d, y, h, mi] = shown.match(/\d+/g)!.map(Number);
		target = guess - (Date.UTC(y, m - 1, d, h, mi) - guess);
	}
	return { enabled: fields?.countdownEnabled === "true" && target > 0, target, label: fields?.countdownLabel?.trim() ?? "Next collection drops in" };
}

// The hero product can rename its card (e.g. "Christmas Crumbie Card"); other products keep the default.
export function cardForProduct(card: CardOption, promo: Promo | null, productId: string): CardOption {
	if (!promo || promo.productId !== productId) return card;
	return { ...card, label: promo.cardLabel || card.label, description: promo.cardDescription || card.description, price: promo.cardPrice };
}

// Closing banner at the bottom of each product page.
export function exploreCopyFrom(fields: Record<string, string> | undefined) {
	return {
		title: fields?.exploreTitle?.trim() || "Find your next favourite crumb",
		subtext: fields?.exploreSubtext?.trim() ?? "Fresh batches, baked to order and ready for pickup. Browse every flavour.",
	};
}

export const defaultUnavailableMessage = "This product or box size is no longer available. Please remove it and choose another box.";

// Shown in the checkout alert when a cart item can no longer be ordered.
export function unavailableMessageFrom(fields: Record<string, string> | undefined) {
	return fields?.unavailableMessage?.trim() || defaultUnavailableMessage;
}
