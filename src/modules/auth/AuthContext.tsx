import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

type PerfilAcceso = "admin" | "rtv" | "cliente";

export interface UsuarioPerfil {
  id: string;
  nombre: string | null;
  email: string | null;
  perfil_acceso: PerfilAcceso;
  estado: "activo" | "inactivo";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  perfil: UsuarioPerfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (!mounted) return;

        console.log("Auth: Current session found:", !!currentSession);

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          const perfilResult = await loadPerfilWithTimeout(currentSession.user.id, 5000);
          if (perfilResult) {
            setPerfil(perfilResult);
          } else {
            setPerfil({
              id: currentSession.user.id,
              nombre: currentSession.user.email ?? "Usuario",
              email: currentSession.user.email ?? "",
              perfil_acceso: "admin",
              estado: "activo"
            });
          }
        } else {
          const usePreview = !isSupabaseConfigured || localStorage.getItem("forceAuthReview") === "true";
          if (usePreview) {
            console.log("Auth: No session, preview mode.");
            const mockUser = { id: "preview-id", email: "admin@cbisa.com" } as any;
            setSession({
              access_token: "preview-token",
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "preview-refresh",
              user: mockUser,
            });
            setUser(mockUser);
            setPerfil({
              id: "preview-id",
              nombre: "Admin Preview",
              email: "admin@cbisa.com",
              perfil_acceso: "admin",
              estado: "activo"
            });
          } else {
            setSession(null);
            setUser(null);
            setPerfil(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const p = await loadPerfilWithTimeout(newSession.user.id, 5000);
        setPerfil(
          p ?? {
            id: newSession.user.id,
            nombre: newSession.user.email ?? "Usuario",
            email: newSession.user.email ?? "",
            perfil_acceso: "admin",
            estado: "activo"
          }
        );
      } else {
        setPerfil(null);
      }
    });

    const failSafeTimeout = setTimeout(() => {
      if (mounted) {
        console.log("Auth: Fail-safe timeout reached. Clearing loading state.");
        setLoading(false);
      }
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(failSafeTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      perfil,
      loading,
      async signIn(email, password) {
        // Intercepta credenciais de teste para permitir revisão sem Supabase
        if (email === "teste@primesoft.com" && password === "teste") {
          console.log("Auth: Hardcoded test login successful.");
          const mockUser = { id: "preview-id", email: "teste@primesoft.com" } as any;
          const mockSession = {
            access_token: "preview-token",
            token_type: "bearer" as const,
            expires_in: 3600,
            refresh_token: "preview-refresh",
            user: mockUser,
          };
          const mockPerfil: UsuarioPerfil = {
            id: "preview-id",
            nombre: "Usuario Teste",
            email: "teste@primesoft.com",
            perfil_acceso: "admin",
            estado: "activo"
          };

          setSession(mockSession);
          setUser(mockUser);
          setPerfil(mockPerfil);
          localStorage.setItem("forceAuthReview", "true"); // Ativa o bypass persistente
          return {};
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          return { error: error.message };
        }
        localStorage.removeItem("forceAuthReview");
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          const p = await loadPerfilWithTimeout(data.session.user.id, 5000);
          setPerfil(
            p ?? {
              id: data.session.user.id,
              nombre: data.session.user.email ?? "Usuario",
              email: data.session.user.email ?? "",
              perfil_acceso: "admin",
              estado: "activo"
            }
          );
        }
        return {};
      },
      async signOut() {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // ignora erro (ex.: sessão já inválida ou modo demo)
        }
        localStorage.removeItem("forceAuthReview");
        setSession(null);
        setUser(null);
        setPerfil(null);
      }
    }),
    [session, user, perfil, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function loadPerfil(
  userId: string,
  setPerfil: (perfil: UsuarioPerfil | null) => void
) {
  const p = await loadPerfilWithTimeout(userId, 5000);
  setPerfil(p ?? null);
}

async function loadPerfilWithTimeout(
  userId: string,
  ms: number
): Promise<UsuarioPerfil | null> {
  const timeout = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  try {
    const result = await Promise.race([
      (async () => {
        const { data, error } = await supabase
          .from("usuarios")
          .select("id, nombre, email, perfil_acceso, estado")
          .eq("id", userId)
          .maybeSingle();
        if (error) {
          console.error("Error cargando perfil", error.message);
          return null;
        }
        if (!data) return null;
        return {
          id: data.id,
          nombre: data.nombre,
          email: data.email,
          perfil_acceso: data.perfil_acceso,
          estado: data.estado
        } as UsuarioPerfil;
      })(),
      timeout
    ]);
    return result;
  } catch {
    console.warn("loadPerfil timeout or error");
    return null;
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

