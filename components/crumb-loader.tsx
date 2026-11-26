export default function CrumbLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="crumb-loader" role="status" aria-live="polite" aria-label={label}>
      <i /><i /><i />
    </div>
  );
}
