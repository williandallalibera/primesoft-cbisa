import { useState } from "react";
import { MonitoreoTab } from "./MonitoreoTab";
import { SiembraTab } from "./SiembraTab";
import { AplicacionesTab } from "./AplicacionesTab";
import { EvaluacionesTab } from "./EvaluacionesTab";
import { CosechasTab } from "./CosechasTab";
import { RteTab } from "./RteTab";

type TabKey = "monitoreo" | "siembra" | "aplicaciones" | "evaluaciones" | "cosechas" | "rte";

export function MonitoreoPage() {
  const [tab, setTab] = useState<TabKey>("monitoreo");

  const tabs = [
    { id: "monitoreo", label: "Dashboard Macro" },
    { id: "siembra", label: "Siembra" },
    { id: "aplicaciones", label: "Aplicaciones" },
    { id: "evaluaciones", label: "Evaluaciones" },
    { id: "cosechas", label: "Cosechas" },
    { id: "rte", label: "Resultado Técnico" },
  ];

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-6 py-4">
          <h3 className="text-lg font-bold text-white mb-0">Seguimiento y Monitoreo</h3>
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
            {tab === "monitoreo" && <MonitoreoTab />}
            {tab === "siembra" && <SiembraTab />}
            {tab === "aplicaciones" && <AplicacionesTab />}
            {tab === "evaluaciones" && <EvaluacionesTab />}
            {tab === "cosechas" && <CosechasTab />}
            {tab === "rte" && <RteTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

