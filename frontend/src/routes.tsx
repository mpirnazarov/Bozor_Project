import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Modal";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { AdminPage } from "@/pages/AdminPage";
import { SuperDashboardPage } from "@/pages/SuperDashboardPage";
import { SuperAdminPage } from "@/pages/SuperAdminPage";
import { OwnerPage } from "@/pages/OwnerPage";
import { RailwayDetailPage } from "@/pages/RailwayDetailPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { ManagersPage } from "@/pages/ManagersPage";

const ADMIN_ROLES = ["admin", "super_admin", "market_admin"];

function Protected({
  children,
  adminOnly,
  superOnly,
  ownerOnly,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  superOnly?: boolean;
  ownerOnly?: boolean;
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
  if (ownerOnly && user.role !== "owner") return <Navigate to="/" replace />;
  if (superOnly && user.role !== "super_admin") return <Navigate to="/" replace />;
  if (adminOnly && !ADMIN_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  // Login bo'lgan foydalanuvchi uchun default sahifa roliga qarab
  const homeForUser =
    user?.role === "owner" ? "/owner" : user?.role === "super_admin" ? "/super" : "/";
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
        path="/owner"
        element={
          <Protected ownerOnly>
            <OwnerPage />
          </Protected>
        }
      />
      <Route
        path="/owner/railway"
        element={
          <Protected ownerOnly>
            <RailwayDetailPage />
          </Protected>
        }
      />
      <Route
        path="/owner/invoices"
        element={
          <Protected ownerOnly>
            <InvoicesPage />
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
      <Route
        path="/managers"
        element={
          <Protected adminOnly>
            <ManagersPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
