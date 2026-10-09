import { Checks, ChecksBand } from "@/components/sections/Checks";
import { Faq, Requirements } from "@/components/sections/Closing";
import { Exports } from "@/components/sections/Exports";
import { Hero, Stats } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Privacy } from "@/components/sections/Privacy";
import { Problem } from "@/components/sections/Problem";
import { Review } from "@/components/sections/Review";

// Section order and copy follow LANDING.md. Privacy comes before the features on purpose.
// The look follows the reference kit (dark night blocks, lime highlights, rounded containers).
export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Problem />
      <Privacy />
      <HowItWorks />
      <ChecksBand />
      <Checks />
      <Review />
      <Exports />
      <Requirements />
      <Faq />
    </>
  );
}
