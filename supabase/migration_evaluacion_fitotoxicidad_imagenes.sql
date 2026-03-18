-- Migration: Fitotoxicidad + 3 imágenes en evaluaciones
-- Ejecutar en el SQL Editor del Dashboard Supabase si su BD ya existía sin estas columnas.

-- Tabla de catálogo fitotoxicidad
CREATE TABLE IF NOT EXISTS fitotoxicidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO fitotoxicidad (descripcion)
VALUES ('Ninguna'), ('Leve'), ('Moderada'), ('Severa')
ON CONFLICT (descripcion) DO NOTHING;

-- Columna id_fitotoxicidad en evaluaciones (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evaluaciones' AND column_name = 'id_fitotoxicidad'
  ) THEN
    ALTER TABLE evaluaciones ADD COLUMN id_fitotoxicidad uuid REFERENCES fitotoxicidad(id);
  END IF;
END $$;

-- Columnas de imágenes (si no existen; reemplazan img_plagas_url, img_enfermedades_url, img_malezas_url)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evaluaciones' AND column_name = 'imagen_1_url') THEN
    ALTER TABLE evaluaciones ADD COLUMN imagen_1_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evaluaciones' AND column_name = 'imagen_2_url') THEN
    ALTER TABLE evaluaciones ADD COLUMN imagen_2_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evaluaciones' AND column_name = 'imagen_3_url') THEN
    ALTER TABLE evaluaciones ADD COLUMN imagen_3_url text;
  END IF;
END $$;
