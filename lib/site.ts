export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://clubcrumbie.com").replace(/\/$/, "");
export const siteName = "Club Crumbie";
export const siteDescription = "Gourmet cookie boxes, baked fresh and made to order.";

export function absoluteUrl(path: string) {
	return /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
