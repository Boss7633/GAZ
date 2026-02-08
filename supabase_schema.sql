
-- ==========================================
-- 1. EXTENSIONS & PRÉPARATION
-- ==========================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. TYPES PERSONNALISÉS (ENUMS)
-- ==========================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'CLIENT', 'LIVREUR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PENDING',     -- Commande créée par le client
            'ASSIGNED',    -- Livreur assigné par l'admin
            'IN_PROGRESS', -- Livreur en route
            'ARRIVED',     -- Livreur sur place, attente espèces + validation client
            'DELIVERED',   -- Livraison terminée et confirmée
            'CANCELLED'    -- Commande annulée
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('CASH', 'WAVE', 'ORANGE_MONEY', 'MTN_MOMO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
        CREATE TYPE kyc_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
    END IF;
END $$;

-- ==========================================
-- 3. TABLES DU SYSTÈME
-- ==========================================

-- Table PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role public.user_role DEFAULT 'CLIENT',
    avatar_url TEXT,
    is_online BOOLEAN DEFAULT false,
    kyc_status public.kyc_status DEFAULT 'PENDING',
    last_location GEOGRAPHY(POINT, 4326),
    rating DECIMAL DEFAULT 5.0,
    wallet_balance DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL PRIMARY KEY,
    size DECIMAL NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table REGIONAL_PRICING
CREATE TABLE IF NOT EXISTS public.regional_pricing (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    region_name TEXT NOT NULL,
    price DECIMAL NOT NULL,
    delivery_fee DECIMAL DEFAULT 1000,
    UNIQUE(product_id, region_name)
);

-- Table ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.profiles(id) NOT NULL,
    livreur_id UUID REFERENCES public.profiles(id),
    status public.order_status DEFAULT 'PENDING',
    payment_method public.payment_method DEFAULT 'CASH',
    items JSONB NOT NULL,
    total_amount DECIMAL NOT NULL,
    delivery_fee DECIMAL DEFAULT 1000,
    delivery_address TEXT,
    delivery_location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. INDEXATION SPATIALE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles USING GIST (last_location);
CREATE INDEX IF NOT EXISTS idx_orders_location ON public.orders USING GIST (delivery_location);

-- ==========================================
-- 5. SÉCURITÉ (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_pricing ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture publique
DROP POLICY IF EXISTS "Public: lecture profils" ON public.profiles;
CREATE POLICY "Public: lecture profils" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public: lecture produits" ON public.products;
CREATE POLICY "Public: lecture produits" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public: lecture prix" ON public.regional_pricing;
CREATE POLICY "Public: lecture prix" ON public.regional_pricing FOR SELECT USING (true);

-- Politiques Utilisateurs
DROP POLICY IF EXISTS "Users: update personnel" ON public.profiles;
CREATE POLICY "Users: update personnel" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Politiques Commandes
DROP POLICY IF EXISTS "Orders: select personnel" ON public.orders;
CREATE POLICY "Orders: select personnel" ON public.orders FOR SELECT USING (
    auth.uid() = client_id OR auth.uid() = livreur_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

DROP POLICY IF EXISTS "Orders: insert client" ON public.orders;
CREATE POLICY "Orders: insert client" ON public.orders FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Orders: update intervenants" ON public.orders;
CREATE POLICY "Orders: update intervenants" ON public.orders FOR UPDATE USING (
    auth.uid() = client_id OR auth.uid() = livreur_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- ==========================================
-- 6. AUTOMATISATION (FONCTIONS & TRIGGERS)
-- ==========================================

-- Trigger pour la mise à jour automatique du timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- CRÉATION AUTOMATIQUE DU PROFIL (VERSION ROBUSTE)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SET search_path = public
AS $$
DECLARE
  assigned_role public.user_role;
BEGIN
    -- Tentative de conversion du rôle, sinon 'CLIENT' par défaut
    BEGIN
      assigned_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      assigned_role := 'CLIENT'::public.user_role;
    END;

    INSERT INTO public.profiles (id, full_name, email, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
        NEW.email,
        assigned_role,
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 7. DONNÉES INITIALES (SEED)
-- ==========================================
INSERT INTO public.products (size, description) VALUES 
(6, 'Bouteille B6 - Usage domestique léger'),
(12.5, 'Bouteille B12 - Format familial standard'),
(28, 'Bouteille B28 - Usage professionnel / Restaurant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.regional_pricing (product_id, region_name, price, delivery_fee)
SELECT id, 'Abidjan', 2500, 1000 FROM public.products WHERE size = 6
ON CONFLICT (product_id, region_name) DO NOTHING;

INSERT INTO public.regional_pricing (product_id, region_name, price, delivery_fee)
SELECT id, 'Abidjan', 5500, 1000 FROM public.products WHERE size = 12.5
ON CONFLICT (product_id, region_name) DO NOTHING;
