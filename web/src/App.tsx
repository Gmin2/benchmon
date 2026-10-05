import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { clearSocialRedirectParams, completeSocialRedirect, detectSocialRedirectUrl } from "@dynamic-labs-sdk/client";
import { useInitStatus, useUser } from "@dynamic-labs-sdk/react-hooks";
import { DEV } from "./dev";
import { Logo } from "./ui/brand";

// each screen is its own chunk, loaded when its route is first opened
const Decks = lazy(() => import("./screens/Decks").then((m) => ({ default: m.Decks })));
const Home = lazy(() => import("./screens/Home").then((m) => ({ default: m.Home })));
const Play = lazy(() => import("./screens/Play").then((m) => ({ default: m.Play })));
const ProfilePage = lazy(() => import("./screens/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const Ranks = lazy(() => import("./screens/Ranks").then((m) => ({ default: m.Ranks })));
const Shell = lazy(() => import("./screens/Shell").then((m) => ({ default: m.Shell })));
const Trade = lazy(() => import("./screens/Trade").then((m) => ({ default: m.Trade })));
const Welcome = lazy(() => import("./screens/Welcome").then((m) => ({ default: m.Welcome })));

// google sends people back to /home?<oauth params>. a logged out /home redirects to / before App's effect runs and
// would drop those params, so read the url once here, before any routing happens
const landingUrl = new URL(window.location.href);

const splash = (
  <div className="grid h-full place-items-center">
    <Logo className="h-12 w-12 animate-pulse" />
  </div>
);

export default function App() {
  const { data: init } = useInitStatus();
  const { data: user } = useUser();
  const authed = DEV || Boolean(user);

  // coming back from google: finish the sign in, then drop the oauth params from the url
  const [social, setSocial] = useState<"checking" | "done">(DEV ? "done" : "checking");
  useEffect(() => {
    if (DEV) return;
    if (init === "failed") return setSocial("done");
    if (init !== "finished") return;
    (async () => {
      if (!(await detectSocialRedirectUrl({ url: landingUrl }))) return;
      await completeSocialRedirect({ url: landingUrl });
      clearSocialRedirectParams();
    })()
      .catch((e) => console.error("google sign in", e))
      .finally(() => setSocial("done"));
  }, [init]);

  // if dynamic cant start, still show the site logged out instead of hanging on the splash
  const down = !DEV && init === "failed";
  if (!DEV && ((init !== "finished" && !down) || social === "checking")) return splash;

  return (
    <Suspense fallback={splash}>
      {down && (
        <div className="fixed inset-x-0 top-0 z-50 bg-red-500/90 px-4 py-2 text-center text-sm font-medium text-white">
          login is unavailable right now, try again in a minute
        </div>
      )}
      <Routes>
        <Route path="/" element={authed ? <Navigate to="/home" replace /> : <Welcome />} />
        <Route element={authed ? <Shell /> : <Navigate to="/" replace />}>
          <Route path="/home" element={<Home />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/play" element={<Play />} />
          <Route path="/play/:id" element={<Play />} />
          <Route path="/watch" element={<Trade />} />
          <Route path="/trade" element={<Navigate to="/watch" replace />} />
          <Route path="/ranks" element={<Ranks />} />
          {authed && <Route path="/:at" element={<ProfilePage />} />}
        </Route>
        {/* shared profile links work for anyone, logged in or not */}
        {!authed && <Route path="/:at" element={<ProfilePage standalone />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
