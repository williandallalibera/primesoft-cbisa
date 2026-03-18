import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background decorativo (mismo estilo que Login) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-agro-secondary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-agro-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden z-10 border border-gray-100">
        <div className="px-8 py-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 text-gray-400 mb-6">
            <i className="fas fa-map-signs text-4xl" />
          </div>
          <h1 className="text-6xl font-black text-agro-primary tracking-tight mb-2">404</h1>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Página no encontrada</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            La página que buscas no existe, puede haber sido movida o no tienes permiso para acceder.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-agro-primary hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-agro-primary transition-all"
          >
            <i className="fas fa-home" />
            Volver al inicio
          </Link>
        </div>
        <div className="bg-gray-50 px-8 py-4 text-center text-xs text-gray-500 font-medium border-t border-gray-100">
          Primesoft CBISA · Gestión y Monitoreo Agrícola
        </div>
      </div>
    </div>
  );
}
