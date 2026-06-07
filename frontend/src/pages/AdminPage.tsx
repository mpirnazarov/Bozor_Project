import { useState } from "react";
import { Link } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { useT } from "@/i18n/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { DashboardEditor } from "@/components/Admin/DashboardEditor";
import { MapEditor } from "@/components/Admin/MapEditor";
import { ShopsManager } from "@/components/Admin/ShopsManager";
import { ExcelImport } from "@/components/Admin/ExcelImport";
import { AuditLogView } from "@/components/Admin/AuditLogView";
import { DocumentsView } from "@/components/Admin/DocumentsView";

const TABS = [
  { value: "dashboard", tkey: "admin.tab.dashboard" },
  { value: "map", tkey: "admin.tab.map" },
  { value: "shops", tkey: "admin.tab.shops" },
  { value: "import", tkey: "admin.tab.import" },
  { value: "documents", tkey: "admin.tab.documents" },
  { value: "audit", tkey: "admin.tab.audit" },
];

export function AdminPage() {
  const [tab, setTab] = useState("dashboard");
  const t = useT();

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
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft transition-all hover:text-ink data-[state=active]:bg-brand-grad data-[state=active]:text-white data-[state=active]:shadow-glow"
            >
              {t(tt.tkey)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="animate-fade-up">
          <Tabs.Content value="dashboard">
            <DashboardEditor />
          </Tabs.Content>
          <Tabs.Content value="map">
            <MapEditor />
          </Tabs.Content>
          <Tabs.Content value="shops">
            <ShopsManager />
          </Tabs.Content>
          <Tabs.Content value="import">
            <ExcelImport />
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
