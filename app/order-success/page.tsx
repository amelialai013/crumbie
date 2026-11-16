import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Order received", robots: { index: false, follow: false } };

export default function Success() {
	return (
		<section className="section section-warm">
			<div className="shell" style={{ maxWidth: 760, textAlign: "center" }}>
				<h1 className="page-title">Your cookie order is received.</h1>
				<p className="lede" style={{ margin: "24px auto" }}>
					We’ll send confirmation to the email used at checkout once payment is complete. Pickup is in Ivanhoe; until the final address is configured, exact pickup details will be provided separately.
				</p>
				<Link className="btn btn-dark" href="/crumbs">
					Back to crumbs
				</Link>
			</div>
		</section>
	);
}
