import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { setUnauthorizedHandler } from "@/api/client";
import { AppRoutes } from "@/routes";

export function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const clear = useAuthStore((s) => s.clear);
  const loadTheme = useThemeStore((s) => s.load);
  const navigate = useNavigate();

  useEffect(() => {
    // 401 bo'lganda — sessiyani tozalab login sahifasiga
    setUnauthorizedHandler(() => {
      clear();
      navigate("/login", { replace: true });
    });
    checkAuth();
    loadTheme();
  }, [checkAuth, clear, navigate, loadTheme]);

  return <AppRoutes />;
}
