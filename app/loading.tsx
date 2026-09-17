export default function Loading() {
  return (
    <div className="site-loading" role="status" aria-live="polite" aria-label="Loading Club Crumbie">
      <div className="site-loading-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <p>Club Crumbie</p>
      <div className="site-loading-track" aria-hidden="true"><span /></div>
    </div>
  );
}
