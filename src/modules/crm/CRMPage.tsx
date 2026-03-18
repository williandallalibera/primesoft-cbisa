import { useState } from "react";
import { ClientesTab } from "./ClientesTab";
import { PropuestasTab } from "./PropuestasTab";
import { VouchersTab } from "./VouchersTab";
import { VisitasTab } from "./VisitasTab";
import { useAuth } from "../auth/AuthContext";

type TabKey = "clientes" | "propuestas" | "vouchers" | "visitas";

export function CRMPage() {
  const { perfil } = useAuth();
  const [tab, setTab] = useState<TabKey>("clientes");

  const isAdmin = perfil?.perfil_acceso === "admin";

  const tabs = [
    { id: "clientes", label: "Clientes" },
    { id: "propuestas", label: "Propuestas" },
    ...(isAdmin ? [{ id: "vouchers", label: "Vouchers" } as const] : []),
    { id: "visitas", label: "Visitas" },
  ];

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-6 py-4">
          <h3 className="text-lg font-bold text-white mb-0">Gestión de Clientes y CRM</h3>
        </div>

        <div className="p-6">
          <div className="border-b border-gray-100 mb-6">
            <div className="flex gap-4 overflow-x-auto pb-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`pb-3 px-1 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${tab === t.id
                      ? "border-agro-primary text-agro-primary"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  onClick={() => setTab(t.id as TabKey)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {tab === "clientes" && <ClientesTab />}
            {tab === "propuestas" && <PropuestasTab />}
            {tab === "vouchers" && isAdmin && <VouchersTab />}
            {tab === "visitas" && <VisitasTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

