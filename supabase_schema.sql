-- Supabase Schema for FareEase

-- 1. Vendors Table
CREATE TABLE vendors (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  business_name TEXT NOT NULL,
  kyc_status TEXT DEFAULT 'PENDING',
  identity_type TEXT,
  identity_number TEXT,
  settlement_bank_code TEXT,
  settlement_account_number TEXT,
  total_routed_volume NUMERIC DEFAULT 0,
  verification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Waybills Table
CREATE TABLE waybills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_name TEXT NOT NULL,
  item_value NUMERIC NOT NULL,
  rider_fee NUMERIC NOT NULL,
  app_fee NUMERIC DEFAULT 100,
  rider_name TEXT,
  rider_account TEXT,
  status TEXT DEFAULT 'PENDING',
  virtual_account_number TEXT UNIQUE,
  bank_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Rider Reputation Table
CREATE TABLE rider_reputation (
  rider_account TEXT PRIMARY KEY,
  rider_name TEXT NOT NULL,
  successful_drops INTEGER DEFAULT 0,
  unique_vendors_served INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_reputation ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Vendors: Only owner can read/write their own profile
CREATE POLICY "Vendors can view own profile" ON vendors
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Vendors can update own profile" ON vendors
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Vendors can insert own profile" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Waybills: Only vendor can read/write their own waybills
CREATE POLICY "Vendors can view own waybills" ON waybills
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own waybills" ON waybills
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

-- Rider Reputation: All authenticated vendors can read
CREATE POLICY "Authenticated users can view rider reputation" ON rider_reputation
  FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime: Enable for waybills
ALTER PUBLICATION supabase_realtime ADD TABLE waybills;
