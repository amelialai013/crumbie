export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://clubcrumbie.com").replace(/\/$/, "");
export const siteName = "Club Crumbie";
export const siteDescription = "Premium small-batch cookie boxes for pickup in Ivanhoe, Victoria.";

export function absoluteUrl(path: string) {
	return /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
