import { Outlet, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { RoleRoute } from "../auth/RoleRoute";
import { AjustesPage } from "../ajustes/AjustesPage";
import { ProductosPage } from "../productos/ProductosPage";
import { CRMPage } from "../crm/CRMPage";
import { ParcelasPage } from "../parcelas/ParcelasPage";
import { MonitoreoPage } from "../monitoreo/MonitoreoPage";
import { AgenteIAPage } from "../agente-ia/AgenteIAPage";
import { EspacioClientePage } from "../espacio-cliente/EspacioClientePage";
import { supabase } from "../../lib/supabaseClient";

function DashboardPage() {
  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-6 py-4">
          <h3 className="text-lg font-bold text-white mb-0">Panel principal</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600">
            Bienvenido al sistema de monitoreo agrícola <span className="font-bold text-agro-primary">Primesoft CBISA</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { perfil, session, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUpdatedAt, setLogoUpdatedAt] = useState<string | null>(null);

  if (!loading && !session && !perfil) {
    return <Navigate to="/login" replace />;
  }

  const fetchLogo = () => {
    if (localStorage.getItem("forceAuthReview") === "true") return;
    supabase.from("empresa").select("logo_url, updated_at").order("id", { ascending: true }).limit(1).maybeSingle().then(({ data }) => {
      const row = data as { logo_url?: string; updated_at?: string } | null;
      const url = row?.logo_url ?? null;
      const updatedAt = row?.updated_at ?? null;
      setLogoUrl(url);
      setLogoUpdatedAt(updatedAt);
      if (url) try { localStorage.setItem("empresa_logo_url", url); } catch { /* ignore */ }
    });
  };

  useEffect(() => {
    fetchLogo();
  }, []);

  useEffect(() => {
    fetchLogo();
  }, [location.pathname]);

  useEffect(() => {
    const onLogoUpdated = () => fetchLogo();
    window.addEventListener("empresa-logo-updated", onLogoUpdated);
    return () => window.removeEventListener("empresa-logo-updated", onLogoUpdated);
  }, []);

  const menuItems = [
    { path: "/app", icon: "fas fa-tachometer-alt", label: "Dashboard", roles: ["admin", "rtv"] },
    { path: "/app/ajustes", icon: "fas fa-cogs", label: "Ajustes", roles: ["admin"] },
    { path: "/app/productos", icon: "fas fa-boxes", label: "Productos", roles: ["admin", "rtv"] },
    { path: "/app/crm", icon: "fas fa-users", label: "CRM", roles: ["admin", "rtv"] },
    { path: "/app/parcelas", icon: "fas fa-map", label: "Parcelas", roles: ["admin", "rtv"] },
    { path: "/app/monitoreo", icon: "fas fa-seedling", label: "Monitoreo", roles: ["admin", "rtv"] },
    { path: "/app/agente-ia", icon: "fas fa-robot", label: "Agente de IA", roles: ["admin"] },
    { path: "/app/espacio-cliente", icon: "fas fa-user-circle", label: "Espacio del Cliente", roles: ["admin", "rtv", "cliente"] },
  ];

  const filteredMenu = perfil
    ? menuItems.filter((item) => item.roles.includes(perfil.perfil_acceso))
    : menuItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white w-64 flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-64 absolute h-full ring-0'} z-50`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          {logoUrl ? (
            <img src={`${logoUrl}${logoUrl.includes("?") ? "&" : "?"}t=${logoUpdatedAt || ""}`} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10 flex-shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 bg-agro-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-leaf text-white text-sm"></i>
            </div>
          )}
          <span className="font-bold text-lg tracking-tight">CBISA</span>
        </div>

        <nav className="p-4 space-y-1">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/app" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                  ? 'bg-agro-primary text-white shadow-lg shadow-agro-primary/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <i className={`${item.icon} w-5 text-center`}></i>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Aviso modo demo */}
        {perfil?.id === "preview-id" && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-sm">
            <i className="fas fa-info-circle"></i>
            <span>Modo demo — datos de ejemplo. Para usar datos reales, cierre sesión e ingrese con su usuario de Supabase.</span>
          </div>
        )}
        {/* Header */}
        <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
              <i className="fas fa-bars"></i>
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Primesoft CBISA</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-gray-900">{perfil?.nombre ?? "Usuario"}</span>
              <span className="text-xs text-gray-500 capitalize">{perfil?.perfil_acceso}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Routes Container */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route
              index
              element={
                perfil?.perfil_acceso === "cliente" ? (
                  <Navigate to="/app/espacio-cliente" replace />
                ) : (
                  <DashboardPage />
                )
              }
            />

            <Route path="ajustes/*" element={<RoleRoute allowed={["admin"]}><AjustesPage /></RoleRoute>} />
            <Route path="productos/*" element={<RoleRoute allowed={["admin", "rtv"]}><ProductosPage /></RoleRoute>} />
            <Route path="crm/*" element={<RoleRoute allowed={["admin", "rtv"]}><CRMPage /></RoleRoute>} />
            <Route path="parcelas/*" element={<RoleRoute allowed={["admin", "rtv"]}><ParcelasPage /></RoleRoute>} />
            <Route path="monitoreo/*" element={<RoleRoute allowed={["admin", "rtv"]}><MonitoreoPage /></RoleRoute>} />
            <Route path="agente-ia/*" element={<RoleRoute allowed={["admin"]}><AgenteIAPage /></RoleRoute>} />
            <Route path="espacio-cliente/*" element={<RoleRoute allowed={["cliente", "admin"]}><EspacioClientePage /></RoleRoute>} />

            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}


function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <section className="content">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h3 className="card-title mb-0">{titulo}</h3>
              </div>
              <div className="card-body">
                <p>
                  Esta sección será implementada conforme al PRD de Primesoft
                  CBISA.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

