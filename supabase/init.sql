-- Script Inicial de Estrutura Supabase - Primesoft CBISA
-- Copie e cole este script no SQL Editor do seu Dashboard Supabase.

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Usuários (Extensão do auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    perfil_acceso TEXT CHECK (perfil_acceso IN ('admin', 'rtv', 'cliente')) NOT NULL DEFAULT 'cliente',
    estado TEXT CHECK (estado IN ('activo', 'inactivo')) NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Configuração da Empresa
CREATE TABLE IF NOT EXISTS public.config_empresa (
    id SERIAL PRIMARY KEY,
    ruc TEXT,
    nombre TEXT,
    distrito TEXT,
    departamento TEXT,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    sitio_web TEXT,
    logo_url TEXT,
    logo_informes_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Cotações CBOT
CREATE TABLE IF NOT EXISTS public.config_cbot (
    id SERIAL PRIMARY KEY,
    fecha DATE DEFAULT CURRENT_DATE,
    precio_soja NUMERIC(10, 3),
    precio_maiz NUMERIC(10, 3),
    precio_trigo NUMERIC(10, 3),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Módulo Produtos
CREATE TABLE IF NOT EXISTS public.distribuidores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    ruc TEXT,
    contacto TEXT,
    email TEXT,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    id_distribuidor UUID REFERENCES public.distribuidores(id),
    tipo TEXT CHECK (tipo IN ('Semilla', 'Fertilizante', 'Defensivo')),
    precio_distribuidor NUMERIC(15, 3),
    markup NUMERIC(5, 2) DEFAULT 0,
    precio_final NUMERIC(15, 3),
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Trigger para Atualizar Automático o updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_empresa_updated_at BEFORE UPDATE ON public.config_empresa FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_productos_updated_at BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 7. Trigger para Criar Perfil de Usuário Automaticamente ao Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nombre, email, perfil_acceso)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', 'Novo Usuário'), NEW.email, 'cliente');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Bucket Storage para logos da empresa (opcional: execute no SQL Editor se usar upload de logos)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('empresa', 'empresa', true, 52428800) ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- Dados Iniciais
INSERT INTO public.config_empresa (nombre) VALUES ('Primesoft CBISA Admin') ON CONFLICT DO NOTHING;
