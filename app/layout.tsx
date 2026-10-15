import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import "./motion.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { CartProvider } from "@/components/cart-context";

// A full page load or refresh always starts at the top; in-app back/forward still restores scroll.
const scrollTopOnLoadScript = `try{if(!location.hash){history.scrollRestoration="manual";addEventListener("load",function(){scrollTo(0,0);setTimeout(function(){history.scrollRestoration="auto"},0)})}}catch(e){}`;

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b150f" };
export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://clubcrumbie.com"),
	title: { default: "Club Crumbie", template: "Club Crumbie — %s" },
	description: "Premium small-batch cookie boxes for pickup in Ivanhoe, Victoria.",
	openGraph: {
		title: "Club Crumbie",
		description: "Small-batch cookies, thoughtfully made in Ivanhoe.",
		type: "website",
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={dmSans.variable} data-scroll-behavior="smooth">
			<head>
				<script dangerouslySetInnerHTML={{ __html: scrollTopOnLoadScript }} />
			</head>
			<body>
				<CartProvider>
					<Header />
					<main>{children}</main>
					<Footer />
				</CartProvider>
			</body>
		</html>
	);
}
