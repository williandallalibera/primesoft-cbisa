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
    <div className="p-4 sm:p-6">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-agro-primary px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="text-base sm:text-lg font-bold text-white mb-0">Panel principal</h3>
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-sm sm:text-base text-gray-600">
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUpdatedAt, setLogoUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setIsSidebarOpen(true);
  }, []);

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

  // Só redireciona para login quando não há sessão (perfil pode vir um pouco depois)
  if (!loading && !session) {
    return <Navigate to="/login" replace />;
  }

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay móvil: cierra el menú al tocar fuera */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Cerrar menú"
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={closeSidebar}
        onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
      />

      {/* Sidebar: drawer en móvil, fijo en desktop cuando abierto */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 flex-shrink-0 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={!isSidebarOpen ? { visibility: "hidden" as const } : undefined}
      >
        <div className="p-4 md:p-6 border-b border-slate-800 flex items-center justify-between md:block">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={`${logoUrl}${logoUrl.includes("?") ? "&" : "?"}t=${logoUpdatedAt || ""}`} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10 flex-shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-agro-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-leaf text-white text-sm"></i>
              </div>
            )}
            <span className="font-bold text-lg tracking-tight">CBISA</span>
          </div>
          <button type="button" onClick={closeSidebar} className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg" aria-label="Cerrar menú">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-5rem)]">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/app" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all touch-manipulation ${isActive
                  ? "bg-agro-primary text-white shadow-lg shadow-agro-primary/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
              >
                <i className={`${item.icon} w-5 text-center flex-shrink-0`}></i>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content: en desktop con sidebar abierto deja espacio a la izquierda */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        {/* Aviso modo demo */}
        {perfil?.id === "preview-id" && (
          <div className="bg-amber-500 text-white px-3 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium shadow-sm flex-wrap text-center">
            <i className="fas fa-info-circle flex-shrink-0"></i>
            <span>Modo demo — datos de ejemplo. Para usar datos reales, cierre sesión e ingrese con su usuario de Supabase.</span>
          </div>
        )}
        {/* Header */}
        <header className="bg-white border-b border-gray-100 min-h-14 h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors touch-manipulation"
              aria-label={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <i className="fas fa-bars text-lg"></i>
            </button>
            <h2 className="font-semibold text-gray-800 hidden sm:block truncate">Primesoft CBISA</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex flex-col items-end max-w-[120px] sm:max-w-none">
              <span className="text-xs sm:text-sm font-bold text-gray-900 truncate w-full text-right">{perfil?.nombre ?? "Usuario"}</span>
              <span className="text-xs text-gray-500 capitalize hidden sm:block">{perfil?.perfil_acceso}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors touch-manipulation"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Routes Container */}
        <main className="flex-1 overflow-auto overflow-x-hidden">
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

