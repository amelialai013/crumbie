export default function HeroMedia({ image }: { image: string }) {
  return (
    <div className="hero-media" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- must render before hydration; the orb intro waits on it */}
      <img className="hero-poster" src={image} alt="" fetchPriority="high" decoding="async" />
    </div>
  );
}
