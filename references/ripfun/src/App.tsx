import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./ui/TopNav";
import BottomNav from "./ui/BottomNav";
import Home from "./pages/Home";
import Market from "./pages/Market";
import Explore from "./pages/Explore";
import Packs from "./pages/Packs";

const PAGES: Record<string, () => React.JSX.Element> = { home: Home, market: Market, explore: Explore, packs: Packs };
const read = () => (location.hash.slice(1) in PAGES ? location.hash.slice(1) : "home");

export default function App() {
  const [page, setPage] = useState(read);
  useEffect(() => {
    const on = () => setPage(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = (p: string) => {
    location.hash = p;
    scrollTo(0, 0);
  };
  const Page = PAGES[page];
  return (
    <div className="relative min-h-svh bg-[radial-gradient(ellipse_at_50%_-10%,#15261c_0%,#0d0d10_55%)]">
      <TopNav go={go} />
      <AnimatePresence mode="wait">
        <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Page />
        </motion.div>
      </AnimatePresence>
      <BottomNav page={page} go={go} />
    </div>
  );
}
