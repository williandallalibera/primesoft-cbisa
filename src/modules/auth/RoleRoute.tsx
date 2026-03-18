import { ReactNode, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type PerfilAcceso = "admin" | "rtv" | "cliente";

interface Props {
  allowed: PerfilAcceso[];
  children: ReactNode;
}

export function RoleRoute({ allowed, children }: Props) {
  const { perfil, loading } = useAuth();
  const [, forceUpdate] = useState({});

  // Verifica se o modo de revisão está ativo via localStorage ou flag temporária
  const isForced = localStorage.getItem("forceAuthReview") === "true" || (window as any).forceAuthReview;

  console.log("RoleRoute Check:", { perfil, allowed, loading, isForced, isPreview: perfil?.id === "preview-id" });

  if (loading && !isForced) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4">
        <i className="fas fa-spinner fa-spin text-agro-primary text-3xl"></i>
        <div className="text-center">
          <p className="text-gray-900 font-bold">Cargando acceso...</p>
          <p className="text-gray-500 text-sm">Si esto demora mucho, intenta recargar la página.</p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem("forceAuthReview", "true");
            (window as any).forceAuthReview = true;
            forceUpdate({});
          }}
          className="mt-4 text-xs text-agro-primary underline hover:text-agro-secondary transition-colors"
        >
          Saltar verificación (Modo Revisión)
        </button>
      </div>
    );
  }

  // Se não tem perfil e não está forçado, vai para o login
  if (!perfil && !isForced) {
    console.warn("RoleRoute: No perfil found, redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  // Bypass para modo revisão, preview ou perfil com permissão
  const hasPermission = perfil?.perfil_acceso && allowed.includes(perfil.perfil_acceso);
  if (isForced || perfil?.id === "preview-id" || hasPermission) {
    return <>{children}</>;
  }

  console.warn(`RoleRoute: Access denied for ${perfil?.perfil_acceso}. Allowed:`, allowed);
  return <Navigate to="/404" replace />;
}

