import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import IntroSplash from "@/components/lobby/IntroSplash";
import { ROUTES } from "@/routes/paths";

export default function SplashPage() {
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    navigate(ROUTES.welcome, { replace: true });
  }, [navigate]);

  return <IntroSplash onComplete={handleComplete} />;
}
