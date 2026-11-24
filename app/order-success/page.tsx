import type { Metadata } from "next";
import Link from "next/link";
import { getRecord } from "@/lib/store";
import ClearCartOnSuccess from "@/components/clear-cart-on-success";

export const metadata: Metadata = { title: "Order received", robots: { index: false, follow: false } };

export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
	const { session_id } = await searchParams;
	const content = await getRecord<{ fields?: Record<string, string> }>("content", "order confirmation").catch(() => null);
	const f = content?.fields || {};
	return (
		<section className="section" style={{ background: "#2a2017" }}>
			{session_id && <ClearCartOnSuccess />}
			<div className="shell" style={{ maxWidth: 760, textAlign: "center" }}>
				<h1 className="page-title">{f.pageTitle || "Your cookie order is received."}</h1>
				<p className="lede" style={{ margin: "24px auto" }}>
					{f.message || "We’ll send confirmation to the email used at checkout once payment is complete. Pickup is in Ivanhoe; until the final address is configured, exact pickup details will be provided separately."}
				</p>
				<Link className="btn btn-dark" href="/crumbs">
					{f.buttonLabel || "Back to crumbs"}
				</Link>
			</div>
		</section>
	);
}
