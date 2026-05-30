import { useState } from "react";
import { Link } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft } from "lucide-react";
import { DashboardEditor } from "@/components/Admin/DashboardEditor";
import { MapEditor } from "@/components/Admin/MapEditor";
import { ExcelImport } from "@/components/Admin/ExcelImport";
import { AuditLogView } from "@/components/Admin/AuditLogView";

const TABS = [
  { value: "dashboard", label: "Dashboard summalari" },
  { value: "map", label: "Xarita muharriri" },
  { value: "import", label: "Excel import" },
  { value: "audit", label: "Audit log" },
];

export function AdminPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Boshqaruv</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Admin panel</h1>
        </div>
        <Link to="/" className="btn-ghost px-3.5 py-2">
          <ArrowLeft size={16} /> Asosiy sahifa
        </Link>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-white/60 bg-white/70 p-1 shadow-soft backdrop-blur">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft transition-all hover:text-ink data-[state=active]:bg-brand-grad data-[state=active]:text-white data-[state=active]:shadow-glow"
            >
              {t.label}
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
          <Tabs.Content value="import">
            <ExcelImport />
          </Tabs.Content>
          <Tabs.Content value="audit">
            <AuditLogView />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
