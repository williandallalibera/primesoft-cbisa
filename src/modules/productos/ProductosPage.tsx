import { useState } from "react";
import { DistribuidorTab } from "./DistribuidorTab";
import { ProductoTab } from "./ProductoTab";

type TabKey = "distribuidor" | "producto";

export function ProductosPage() {
  const [tab, setTab] = useState<TabKey>("distribuidor");

  const tabs = [
    { id: "distribuidor", label: "Distribuidor" },
    { id: "producto", label: "Producto / Insumo" },
  ];

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-6 py-4">
          <h3 className="text-lg font-bold text-white mb-0">Catálogo de Productos</h3>
        </div>

        <div className="p-6">
          <div className="border-b border-gray-100 mb-6">
            <div className="flex gap-4">
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
            {tab === "distribuidor" && <DistribuidorTab />}
            {tab === "producto" && <ProductoTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

