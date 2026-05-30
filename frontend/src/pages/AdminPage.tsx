import { useState } from "react";
import { Link } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft } from "lucide-react";
import { DashboardEditor } from "@/components/Admin/DashboardEditor";
import { ExcelImport } from "@/components/Admin/ExcelImport";
import { AuditLogView } from "@/components/Admin/AuditLogView";

const TABS = [
  { value: "dashboard", label: "Dashboard summalari" },
  { value: "import", label: "Excel import" },
  { value: "audit", label: "Audit log" },
];

export function AdminPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-800">Admin panel</h1>
        <Link to="/" className="btn-ghost">
          <ArrowLeft size={16} /> Asosiy sahifa
        </Link>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-slate-500 transition-colors data-[state=active]:border-brand data-[state=active]:text-brand"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="dashboard">
          <DashboardEditor />
        </Tabs.Content>
        <Tabs.Content value="import">
          <ExcelImport />
        </Tabs.Content>
        <Tabs.Content value="audit">
          <AuditLogView />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
