import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import "./motion.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import SubscribePopup from "@/components/subscribe-popup";
import { getRecord } from "@/lib/store";
import { CartProvider } from "@/components/cart-context";
import { defaultSearchImage, getSearchImage } from "@/lib/catalog-store";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

// A full page load or refresh always starts at the top; in-app back/forward still restores scroll.
const scrollTopOnLoadScript = `try{if(!location.hash){history.scrollRestoration="manual";addEventListener("load",function(){scrollTo(0,0);setTimeout(function(){history.scrollRestoration="auto"},0)})}}catch(e){}`;

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1a140d" };
export async function generateMetadata(): Promise<Metadata> {
	const image = await getSearchImage();
	const size = image === defaultSearchImage ? { width: 1200, height: 700 } : {};
	return {
		metadataBase: new URL(siteUrl),
		title: { default: "Club Crumbie", template: "%s | Club Crumbie" },
		description: siteDescription,
		applicationName: siteName,
		alternates: { canonical: "./" },
		openGraph: {
			siteName,
			title: "Club Crumbie",
			description: siteDescription,
			type: "website",
			locale: "en_AU",
			images: [{ url: image, ...size, alt: "Club Crumbie cookie boxes" }],
		},
		twitter: { card: "summary_large_image", images: [image] },
	};
}

const organizationJsonLd = (image: string) => ({
	"@context": "https://schema.org",
	"@type": "Bakery",
	name: siteName,
	url: siteUrl,
	description: siteDescription,
	image: new URL(image, siteUrl).href,
	servesCuisine: "Cookies",
	areaServed: "Melbourne, Victoria, Australia",
	priceRange: "$$",
	currenciesAccepted: "AUD",
	paymentAccepted: "Credit Card, Debit Card",
	geo: { "@type": "GeoCoordinates", latitude: -37.7686, longitude: 145.0446 },
	potentialAction: { "@type": "OrderAction", target: `${siteUrl}/crumbs`, deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModePickUp", "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"] },
	address: { "@type": "PostalAddress", addressLocality: "Ivanhoe", addressRegion: "VIC", addressCountry: "AU" },
	sameAs: ["https://instagram.com/clubcrumbie", "https://tiktok.com/@clubcrumbie", "https://facebook.com/clubcrumbie"],
});

const websiteJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: siteName,
	alternateName: ["Club Crumbie Cookies", "Crumbie"],
	url: siteUrl,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const searchImage = await getSearchImage();
	const home = await getRecord<{ fields?: Record<string, string> }>("content", "homepage").catch(() => null);
	const f = home?.fields || {};
	return (
		<html lang="en" className={dmSans.variable} data-scroll-behavior="smooth">
			<head>
				<script dangerouslySetInnerHTML={{ __html: scrollTopOnLoadScript }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(searchImage)) }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
			</head>
			<body>
				<CartProvider>
					<Header />
					<main>{children}</main>
					<Footer />
					<SubscribePopup
							heading={f.popupHeading || "Warm from the oven,\nstraight to you."}
							body={f.popupBody || "Be first to know about new flavours, limited drops and pickup windows. Plus 10% off your first order."}
							placeholder={f.popupPlaceholder || "Your email address"}
							button={f.popupButton || "Join the club"}
							dismiss={f.popupDismiss || "No thanks"}
							doneTitle={f.popupDoneTitle || "Almost there"}
							doneBody={f.popupDoneBody || "Check your inbox and confirm your email to join."}
						/>
				</CartProvider>
			</body>
		</html>
	);
}
