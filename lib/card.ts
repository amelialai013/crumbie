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
