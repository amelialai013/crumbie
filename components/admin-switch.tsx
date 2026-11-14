import styles from "./admin-switch.module.css";

export default function AdminSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className={styles.root}>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
