import { useState } from "react";
import { ParcelasTab } from "./ParcelasTab";
import { ZafrasTab } from "./ZafrasTab";

type TabKey = "parcelas" | "zafras";

export function ParcelasPage() {
  const [tab, setTab] = useState<TabKey>("parcelas");

  const tabs = [
    { id: "parcelas", label: "Parcelas / Polígonos" },
    { id: "zafras", label: "Zafras" },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="text-base sm:text-lg font-bold text-white mb-0">Gestión de Parcelas</h3>
        </div>

        <div className="p-4 sm:p-6">
          <div className="border-b border-gray-100 mb-4 sm:mb-6">
            <div className="flex gap-4 overflow-x-auto pb-px">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`pb-3 px-1 text-sm font-bold transition-all border-b-2 ${tab === t.id
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
            {tab === "parcelas" && <ParcelasTab />}
            {tab === "zafras" && <ZafrasTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

