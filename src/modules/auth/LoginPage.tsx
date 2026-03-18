import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try { return localStorage.getItem("empresa_logo_url"); } catch { return null; }
  });
  const [logoUpdatedAt, setLogoUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("empresa").select("logo_url, updated_at").order("id", { ascending: true }).limit(1).maybeSingle().then(({ data }) => {
      const row = data as { logo_url?: string; updated_at?: string } | null;
      const url = row?.logo_url ?? null;
      if (url) {
        setLogoUrl(url);
        setLogoUpdatedAt(row?.updated_at ?? null);
        try { localStorage.setItem("empresa_logo_url", url); } catch { /* ignore */ }
      }
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      const msg = result.error;
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
        setError("Credenciales inválidas. Verifique su correo y contraseña.");
      } else if (msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("confirm")) {
        setError("Debe confirmar su correo. Revise su bandeja de entrada o contacte al administrador.");
      } else {
        setError(msg);
      }
      return;
    }
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background Decorativo Agro Premium */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-agro-secondary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-agro-primary/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden z-10 border border-gray-100">
        <div className="px-8 py-10">
          <div className="text-center mb-10">
            {logoUrl ? (
              <img src={`${logoUrl}${logoUrl.includes("?") ? "&" : "?"}t=${logoUpdatedAt || ""}`} alt="Logo" className="w-16 h-16 rounded-full object-contain mx-auto mb-4 bg-gray-50 border border-gray-100" referrerPolicy="no-referrer" />
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-agro-primary/10 text-agro-primary mb-4">
                <i className="fas fa-leaf text-3xl"></i>
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Primesoft CBISA</h1>
            <p className="text-gray-500 mt-2 font-medium">Gestión y Monitoreo Agrícola</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm flex gap-3 shadow-sm">
              <i className="fas fa-exclamation-triangle mt-0.5 text-orange-500"></i>
              <div>
                <strong className="block font-semibold mb-1">Configuración pendiente:</strong>
                <p>Cree un archivo <code className="bg-orange-100 px-1 py-0.5 rounded text-orange-900">.env</code> en la raíz del proyecto con <code className="bg-orange-100 px-1 py-0.5 rounded text-orange-900">VITE_SUPABASE_URL</code> y <code className="bg-orange-100 px-1 py-0.5 rounded text-orange-900">VITE_SUPABASE_ANON_KEY</code>.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm space-y-2">
              <div className="flex gap-3 items-start">
                <i className="fas fa-times-circle text-red-500 text-lg mt-0.5"></i>
                <div>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <i className="fas fa-envelope"></i>
                </div>
                <input
                  id="email"
                  type="email"
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white text-gray-900 focus:ring-2 focus:ring-agro-primary/30 focus:border-agro-primary transition-all shadow-sm"
                  placeholder="ejemplo@cbisa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <i className="fas fa-lock"></i>
                </div>
                <input
                  id="password"
                  type="password"
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white text-gray-900 focus:ring-2 focus:ring-agro-primary/30 focus:border-agro-primary transition-all shadow-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end mt-2">
                <a href="#" className="text-sm font-medium text-agro-secondary hover:text-agro-primary transition-colors">
                  ¿Olvidó su contraseña?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-agro-primary hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-agro-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Ingresando...
                </>
              ) : (
                "Entrar al Sistema"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] text-gray-400">
            {isSupabaseConfigured ? "Supabase conectado" : "Supabase no configurado"}
          </p>
        </div>
        <div className="bg-gray-50 px-8 py-5 text-center text-xs text-gray-500 font-medium border-t border-gray-100">
          © {new Date().getFullYear()} Company Business Incorporation S.A.
        </div>
      </div>
    </div>
  );
}

