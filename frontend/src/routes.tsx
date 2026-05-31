import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Modal";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { AdminPage } from "@/pages/AdminPage";
import { SuperDashboardPage } from "@/pages/SuperDashboardPage";
import { SuperAdminPage } from "@/pages/SuperAdminPage";

const ADMIN_ROLES = ["admin", "super_admin", "market_admin"];

function Protected({
  children,
  adminOnly,
  superOnly,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  superOnly?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (superOnly && user.role !== "super_admin") return <Navigate to="/" replace />;
  if (adminOnly && !ADMIN_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  // Login bo'lgan super_admin uchun default sahifa super dashboard
  const homeForUser = user?.role === "super_admin" ? "/super" : "/";
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homeForUser} replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <HomePage />
          </Protected>
        }
      />
      <Route
        path="/super"
        element={
          <Protected superOnly>
            <SuperDashboardPage />
          </Protected>
        }
      />
      <Route
        path="/super/markets"
        element={
          <Protected superOnly>
            <SuperAdminPage />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected adminOnly>
            <AdminPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
