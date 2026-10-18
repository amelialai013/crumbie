// The home layout's OrbIntro already covers the screen, so the fallback only reserves the
// hero's space. A second orb here would stack on it and restart its pulse when swapped out.
export default function Loading() {
  return <div className="home-loading" aria-hidden="true" />;
}
