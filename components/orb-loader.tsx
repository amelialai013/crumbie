export default function OrbLoader({ label = "Loading Club Crumbie" }: { label?: string }) {
  return (
    <div className="orb-loading" role="status" aria-live="polite" aria-label={label}>
      <div className="orb" aria-hidden="true">
        <span className="orb-halo" />
        <span className="orb-core" />
      </div>
    </div>
  );
}
