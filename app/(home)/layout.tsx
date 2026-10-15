import OrbIntro from "@/components/orb-intro";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrbIntro />
      {children}
    </>
  );
}
