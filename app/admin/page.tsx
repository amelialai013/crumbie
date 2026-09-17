import type { Metadata } from "next";
import AdminDashboard from "@/components/admin-dashboard";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function Admin() {
	return (
		<section className="section section-warm">
			<div className="shell">
				<AdminDashboard />
			</div>
		</section>
	);
}
