import { useState } from "react";
import { EmpresaTab } from "./EmpresaTab";
import { CbotTab } from "./CbotTab";
import { UsuariosTab } from "./UsuariosTab";
import { IntegracionesTab } from "./IntegracionesTab";

type TabKey = "empresa" | "usuarios" | "cbot" | "integraciones";

export function AjustesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("empresa");

  const tabs = [
    { id: "empresa", label: "Empresa", icon: "fa-building" },
    { id: "usuarios", label: "Usuarios", icon: "fa-users-cog" },
    { id: "cbot", label: "CBOT", icon: "fa-chart-line" },
    { id: "integraciones", label: "Integraciones", icon: "fa-plug" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-agro-primary/10 rounded-xl text-agro-primary">
          <i className="fas fa-cogs text-xl"></i>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Ajustes del Sistema</h1>
          <p className="text-gray-500 text-sm">Administra la configuración general y usuarios</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8 gap-8 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabKey)}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-bold text-sm transition-all ${activeTab === tab.id
              ? "border-agro-primary text-agro-primary"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
              }`}
          >
            <i className={`fas ${tab.icon} text-base`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {activeTab === "empresa" && <EmpresaTab />}
        {activeTab === "usuarios" && <UsuariosTab />}
        {activeTab === "cbot" && <CbotTab />}
        {activeTab === "integraciones" && <IntegracionesTab />}
      </div>
    </div>
  );
}
