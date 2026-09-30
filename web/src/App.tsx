import { Navigate, Route, Routes } from "react-router-dom";
import { useInitStatus, useUser } from "@dynamic-labs-sdk/react-hooks";
import { DEV } from "./dev";
import { Logo } from "./ui/brand";
import { Decks } from "./screens/Decks";
import { Home } from "./screens/Home";
import { Play } from "./screens/Play";
import { ProfilePage } from "./screens/ProfilePage";
import { Ranks } from "./screens/Ranks";
import { Shell } from "./screens/Shell";
import { Trade } from "./screens/Trade";
import { Welcome } from "./screens/Welcome";

export default function App() {
  const { data: init } = useInitStatus();
  const { data: user } = useUser();
  const authed = DEV || Boolean(user);

  if (!DEV && init !== "finished")
    return (
      <div className="grid h-full place-items-center">
        <Logo className="h-12 w-12 animate-pulse" />
      </div>
    );

  return (
    <Routes>
      <Route path="/" element={authed ? <Navigate to="/home" replace /> : <Welcome />} />
      <Route element={authed ? <Shell /> : <Navigate to="/" replace />}>
        <Route path="/home" element={<Home />} />
        <Route path="/decks" element={<Decks />} />
        <Route path="/play" element={<Play />} />
        <Route path="/play/:id" element={<Play />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/ranks" element={<Ranks />} />
        {authed && <Route path="/:at" element={<ProfilePage />} />}
      </Route>
      {/* shared profile links work for anyone, logged in or not */}
      {!authed && <Route path="/:at" element={<ProfilePage standalone />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
