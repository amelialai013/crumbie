export const termsBodyMaxChars = 1500;

export const termsDefaults: { heading: string; body: string }[] = [
	{ heading: "About these terms", body: "These terms apply when you use clubcrumbie.com or order from Club Crumbie, a small cookie bakery in Ivanhoe, Victoria, Australia. By placing an order you agree to them." },
	{ heading: "Orders and payment", body: "Prices are in Australian dollars. Payment is taken securely by Stripe when you place your order. An order is confirmed once payment succeeds and you receive a confirmation email. See our ordering policy for pickup and delivery details." },
	{ heading: "Allergens", body: "Our cookies are made in a kitchen that handles gluten, dairy, eggs, nuts and soy. We cannot guarantee any product is free from allergens. Please contact us before ordering if you have an allergy." },
	{ heading: "Cancellations and refunds", body: "Every batch is baked to order. If you need to change or cancel an order, contact us as early as possible at clubcrumbieadmin@gmail.com. If something is wrong with your order, tell us within 48 hours and we will make it right. Nothing in these terms limits your rights under the Australian Consumer Law." },
	{ heading: "Using the site", body: "Content on this site, including photos, text and branding, belongs to Club Crumbie and may not be copied or reused without permission. Please do not misuse the site or attempt to interfere with its operation." },
	{ heading: "Changes", body: "We may update these terms from time to time. The version on this page applies to orders placed while it is displayed." },
	{ heading: "Contact", body: "Questions? Email clubcrumbieadmin@gmail.com." },
	{ heading: "Images", body: "Photos and images on this site are for illustration only and some may be AI-generated or digitally enhanced. Actual products may vary slightly. This does not affect your rights under the Australian Consumer Law." },
];

// Images was added after Changes and Contact; it displays before them without shifting saved content slots.
export const termsDisplayOrder: number[] = (() => {
	const images = termsDefaults.findIndex((section) => section.heading === "Images");
	const changes = termsDefaults.findIndex((section) => section.heading === "Changes");
	const order = termsDefaults.map((_, i) => i).filter((i) => i !== images);
	order.splice(changes, 0, images);
	return order;
})();

export const termsDefaultTitle = "Terms of service";
export const termsSectionCount = termsDefaults.length;
export const termsLimits: Record<string, number> = {
	pageTitle: 80,
	...Object.fromEntries(termsDefaults.flatMap((_, i) => [[`s${i + 1}Heading`, 80], [`s${i + 1}Copy`, termsBodyMaxChars]])),
};
