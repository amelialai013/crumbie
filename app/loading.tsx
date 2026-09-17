import { RouteSkeleton } from "@/components/page-loader";

export default function Loading() {
  return (
    <div className="site-loading route-loading" role="status" aria-live="polite" aria-label="Loading Club Crumbie">
      <RouteSkeleton />
    </div>
  );
}
