import Link from "next/link";

export default function Success() {
	return (
		<section className="section section-warm">
			<div className="shell" style={{ maxWidth: 760, textAlign: "center" }}>
				<h1 className="page-title">Your cookies are confirmed.</h1>
				<p className="lede" style={{ margin: "24px auto" }}>
					A confirmation will be sent to the email used at checkout. Pickup is in Ivanhoe; until the final address is configured, exact pickup details will be provided separately.
				</p>
				<Link className="btn btn-dark" href="/cookies" scroll={false}>
					Back to crumbs
				</Link>
			</div>
		</section>
	);
}
