export type CardOption = { enabled: boolean; price: number; label: string; description: string };

export const defaultCardOption: CardOption = {
	enabled: true,
	price: 3,
	label: "Club Crumbie Card",
	description: "Add a card to go inside your Club Crumbie box, so you can leave someone special with a surprise crumb.",
};

// Card settings live in the "settings" content module as strings.
export function cardOptionFrom(fields: Record<string, string> | undefined): CardOption {
	const price = Number(fields?.cardPrice);
	return {
		enabled: fields?.cardEnabled !== "false",
		price: fields?.cardPrice?.trim() && Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : defaultCardOption.price,
		label: fields?.cardLabel?.trim() || defaultCardOption.label,
		description: fields?.cardDescription?.trim() || defaultCardOption.description,
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

export type Promo = { productId: string; label: string; headline: string; blurb: string; button: string; cardLabel: string; cardDescription: string };

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
	};
}

// The hero product can rename its card (e.g. "Christmas Crumbie Card"); other products keep the default.
export function cardForProduct(card: CardOption, promo: Promo | null, productId: string): CardOption {
	if (!promo || promo.productId !== productId) return card;
	return { ...card, label: promo.cardLabel || card.label, description: promo.cardDescription || card.description };
}

// Closing banner at the bottom of each product page.
export function exploreCopyFrom(fields: Record<string, string> | undefined) {
	return {
		title: fields?.exploreTitle?.trim() || "Find your next favourite crumb",
		subtext: fields?.exploreSubtext?.trim() ?? "Fresh batches, baked to order and ready for pickup. Browse every flavour.",
	};
}
