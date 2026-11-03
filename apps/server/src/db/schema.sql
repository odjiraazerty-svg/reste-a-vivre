-- ==============================================================================
-- SCHÉMA OFFICIEL POSTGRESQL 16 — APPLICATION RESTE À VIVRE (RAV)
-- Architecture ACID, Zero-Bank & Synchronisation Idempotente
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    weekend_strategy VARCHAR(30) DEFAULT 'DYNAMIC_WEIGHT', -- DYNAMIC_WEIGHT, WEEKEND_PACK, ROLLOVER
    safety_cushion_pct NUMERIC(4, 2) DEFAULT 0.10,
    subscription_tier VARCHAR(20) DEFAULT 'FREE', -- FREE, PREMIUM_B2C, B2B_CORPORATE
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table Cycles de Paie (Flexibilité calendaire totale)
CREATE TABLE IF NOT EXISTS cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    declared_net_income NUMERIC(12, 2) NOT NULL,
    sanctuary_savings NUMERIC(12, 2) DEFAULT 0.00,
    total_fixed_charges NUMERIC(12, 2) DEFAULT 0.00,
    initial_rav_m NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table Charges Fixes Incompressibles
CREATE TABLE IF NOT EXISTS fixed_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(150) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    category VARCHAR(50) DEFAULT 'AUTRE', -- LOGEMENT, ENERGIE, ASSURANCE, TELECOM, CREDIT, AUTRE
    is_recurring BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des Poches Budgétaires Dynamiques (Personnalisables par l'utilisateur)
CREATE TABLE IF NOT EXISTS pockets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    icon VARCHAR(30) NOT NULL DEFAULT '📁',
    color_hex VARCHAR(7) DEFAULT '#10B981',
    target_percentage NUMERIC(5, 4) NOT NULL CHECK (target_percentage > 0 AND target_percentage <= 1.0000),
    display_order INT NOT NULL DEFAULT 0,
    is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_active_pocket_name UNIQUE NULLS NOT DISTINCT (user_id, name, is_archived)
);

-- Trigger de cohérence financière : la somme des poches actives ne doit pas excéder 100%
CREATE OR REPLACE FUNCTION check_user_pockets_total()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(target_percentage), 0)
    INTO v_total
    FROM pockets
    WHERE user_id = NEW.user_id AND is_archived = FALSE;

    IF v_total > 1.0001 THEN
        RAISE EXCEPTION 'La somme des pourcentages des poches actives ne peut pas dépasser 100%% (actuel: %)', (v_total * 100);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_pocket_percentage
AFTER INSERT OR UPDATE ON pockets
FOR EACH ROW EXECUTE FUNCTION check_user_pockets_total();

-- 5. Table des Dépenses Variables (Saisie Express & Sync Offline-First avec Snapshots)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    pocket_id UUID NOT NULL REFERENCES pockets(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    label VARCHAR(255) DEFAULT '',
    pocket_name_snapshot VARCHAR(60) NOT NULL,
    pocket_icon_snapshot VARCHAR(30) NOT NULL,
    client_sync_id UUID UNIQUE, -- CLÉ D'IDEMPOTENCE POUR L'OFFLINE-FIRST
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des Conseils IA & Nudges (Anonymisés)
CREATE TABLE IF NOT EXISTS ai_nudges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INT NOT NULL, -- 1: Protection, 2: Rythme, 3: Asymétrie, 4: Arbitrage
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    potential_daily_gain NUMERIC(8, 2) DEFAULT 0.00,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes en temps réel haute performance
CREATE INDEX IF NOT EXISTS idx_pockets_user_active ON pockets(user_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_pocket ON expenses(pocket_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_sync_id ON expenses(client_sync_id);
CREATE INDEX IF NOT EXISTS idx_cycles_user_active ON cycles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fixed_charges_user ON fixed_charges(user_id);

-- Données initiales de démonstration (Compte Test)
INSERT INTO users (id, email, password_hash, currency, weekend_strategy, subscription_tier)
VALUES (
    '7f83a1b2-c0e4-4d89-9821-654e99f81a02',
    'alexandre.dupont@entreprise.fr',
    '$2b$10$EpRnTzVlqHNP0.fUbXUw3.e9uK07B0qP9t7LqG9r4n7bF1Xm1X7yG', -- 'password123'
    'EUR',
    'DYNAMIC_WEIGHT',
    'FREE'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO cycles (id, user_id, start_date, end_date, declared_net_income, sanctuary_savings, total_fixed_charges, initial_rav_m, is_active)
VALUES (
    'c123a1b2-c0e4-4d89-9821-654e99f81a01',
    '7f83a1b2-c0e4-4d89-9821-654e99f81a02',
    '2026-10-28',
    '2026-11-27',
    2400.00,
    200.00,
    1250.00,
    950.00,
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO fixed_charges (user_id, label, amount, category)
VALUES
    ('7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Loyer Appartement', 820.00, 'LOGEMENT'),
    ('7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Électricité & Chauffage', 110.00, 'ENERGIE'),
    ('7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Assurance Habitation & Santé', 90.00, 'ASSURANCE'),
    ('7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Fibre & Forfait Mobile', 60.00, 'TELECOM'),
    ('7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Prêt Étudiant / Auto', 170.00, 'CREDIT')
ON CONFLICT DO NOTHING;

-- Poches dynamiques initiales configurées pour le compte test
INSERT INTO pockets (id, user_id, name, icon, color_hex, target_percentage, display_order, is_system_default)
VALUES
    ('a1111111-c0e4-4d89-9821-654e99f81a01', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Déjeuner & Repas', '🥗', '#10B981', 0.4000, 1, FALSE),
    ('a2222222-c0e4-4d89-9821-654e99f81a02', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Mobilité & Trajets', '🚗', '#06B6D4', 0.2000, 2, FALSE),
    ('a3333333-c0e4-4d89-9821-654e99f81a03', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Plaisirs & Cafés', '☕', '#8B5CF6', 0.2500, 3, FALSE),
    ('a4444444-c0e4-4d89-9821-654e99f81a04', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'Coussin Sécurité', '🛡️', '#F59E0B', 0.1500, 4, TRUE)
ON CONFLICT DO NOTHING;

-- Dépenses initiales de test
INSERT INTO expenses (id, user_id, cycle_id, pocket_id, amount, expense_date, label, pocket_name_snapshot, pocket_icon_snapshot)
VALUES
    ('e1111111-c0e4-4d89-9821-654e99f81a01', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'c123a1b2-c0e4-4d89-9821-654e99f81a01', 'a1111111-c0e4-4d89-9821-654e99f81a01', 8.50, CURRENT_DATE, 'Menu Midi Express', 'Déjeuner & Repas', '🥗'),
    ('e2222222-c0e4-4d89-9821-654e99f81a02', '7f83a1b2-c0e4-4d89-9821-654e99f81a02', 'c123a1b2-c0e4-4d89-9821-654e99f81a01', 'a2222222-c0e4-4d89-9821-654e99f81a02', 4.20, CURRENT_DATE, 'Tickets Métro', 'Mobilité & Trajets', '🚗')
ON CONFLICT DO NOTHING;
