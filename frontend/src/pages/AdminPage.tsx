import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { useT } from "@/i18n/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { DashboardEditor } from "@/components/Admin/DashboardEditor";
import { MapEditor } from "@/components/Admin/MapEditor";
import { ShopsManager } from "@/components/Admin/ShopsManager";
import { BillingImport } from "@/components/Admin/BillingImport";
import { ShopOwnerImport } from "@/components/Admin/ShopOwnerImport";
import { RentBillingImport } from "@/components/Admin/RentBillingImport";
import { AuditLogView } from "@/components/Admin/AuditLogView";
import { DocumentsView } from "@/components/Admin/DocumentsView";
import { BillingSummary } from "@/components/Admin/BillingSummary";
import { getMarketInvoices } from "@/api/dashboard";

const TABS = [
  { value: "dashboard", tkey: "admin.tab.dashboard" },
  { value: "summary", tkey: "admin.tab.summary" },
  { value: "map", tkey: "admin.tab.map" },
  { value: "shops", tkey: "admin.tab.shops" },
  { value: "import", tkey: "admin.tab.import" },
  { value: "documents", tkey: "admin.tab.documents" },
  { value: "audit", tkey: "admin.tab.audit" },
];

export function AdminPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    initialTab && TABS.some((t) => t.value === initialTab) ? initialTab : "dashboard"
  );
  const t = useT();

  // To'lanmagan to'lovlar soni — "To'lovlar" vkladkasidagi badge uchun
  const { data: marketInvoices } = useQuery({
    queryKey: ["market-invoices"],
    queryFn: () => getMarketInvoices(),
    refetchInterval: 60_000,
    retry: false,
  });
  const unpaidCount =
    (marketInvoices?.stats?.counts.pending ?? 0) +
    (marketInvoices?.stats?.counts.overdue ?? 0) +
    (marketInvoices?.stats?.counts.partial ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">{t("admin.management")}</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("admin.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/" className="btn-ghost px-3.5 py-2">
            <ArrowLeft size={16} /> {t("common.back")}
          </Link>
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-white/60 bg-white/70 p-1 shadow-soft backdrop-blur">
          {TABS.map((tt) => (
            <Tabs.Trigger
              key={tt.value}
              value={tt.value}
              className="relative rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft transition-all hover:text-ink data-[state=active]:bg-brand-grad data-[state=active]:text-white data-[state=active]:shadow-glow"
            >
              {t(tt.tkey)}
              {tt.value === "documents" && unpaidCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.1rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white animate-pulse">
                  {unpaidCount > 9 ? "9+" : unpaidCount}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="animate-fade-up">
          <Tabs.Content value="dashboard">
            <DashboardEditor />
          </Tabs.Content>
          <Tabs.Content value="summary">
            <BillingSummary />
          </Tabs.Content>
          <Tabs.Content value="map">
            <MapEditor />
          </Tabs.Content>
          <Tabs.Content value="shops">
            <ShopsManager />
          </Tabs.Content>
          <Tabs.Content value="import">
            <div className="space-y-5">
              <BillingImport />
              <ShopOwnerImport />
              <RentBillingImport />
            </div>
          </Tabs.Content>
          <Tabs.Content value="documents">
            <DocumentsView />
          </Tabs.Content>
          <Tabs.Content value="audit">
            <AuditLogView />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const change = useThemeStore((s) => s.change);
  const t = useT();
  const dark = theme === "dark";
  return (
    <button
      onClick={() => change(dark ? "light" : "dark")}
      className="btn-ghost px-3.5 py-2"
      title={dark ? t("ui.light") : t("ui.dark")}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {dark ? t("ui.light") : t("ui.dark")}
    </button>
  );
}
