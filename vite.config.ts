import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Compatibilidade: se o código importar CSS do admin-lte, usa o FontAwesome do projeto
      "admin-lte/plugins/fontawesome-free/css/all.min.css": path.resolve(
        __dirname,
        "node_modules/@fortawesome/fontawesome-free/css/all.min.css"
      ),
    },
  },
  server: {
    port: 5173
  }
});

