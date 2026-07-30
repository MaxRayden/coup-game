import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GameProvider } from "@/context/GameContext";
import GameJoinPage from "@/pages/GameJoinPage";
import GamePage from "@/pages/GamePage";
import LobbyPage from "@/pages/LobbyPage";
import SplashPage from "@/pages/SplashPage";
import WelcomePage from "@/pages/WelcomePage";
import GameRouteSync from "@/router/GameRouteSync";
import RequireConnection from "@/router/RequireConnection";
import { ROUTES } from "@/routes/paths";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <GameProvider>
        <RequireConnection>
          <GameRouteSync />
          <Routes>
            <Route path={ROUTES.home} element={<SplashPage />} />
            <Route path={ROUTES.welcome} element={<WelcomePage />} />
            <Route path={ROUTES.lobby} element={<LobbyPage />} />
            <Route path={ROUTES.game} element={<GamePage />} />
            <Route path={ROUTES.gameJoin} element={<GameJoinPage />} />
            <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
          </Routes>
        </RequireConnection>
      </GameProvider>
    </BrowserRouter>
  );
}
