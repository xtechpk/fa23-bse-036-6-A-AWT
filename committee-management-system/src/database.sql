-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  reputation_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Committees Table
CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL,
  monthly_amount DECIMAL(10, 2) NOT NULL,
  max_members INTEGER NOT NULL,
  current_members INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Committee Members Table
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  transaction_id VARCHAR(255),
  iban VARCHAR(34),
  bank_account_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(committee_id, user_id)
);

-- Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES committee_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES committee_members(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  month INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('new_committee', 'upcoming_turn', 'payment_update', 'member_joined')),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Better Performance
CREATE INDEX idx_committees_creator_id ON committees(creator_id);
CREATE INDEX idx_committees_status ON committees(status);
CREATE INDEX idx_committee_members_committee_id ON committee_members(committee_id);
CREATE INDEX idx_committee_members_user_id ON committee_members(user_id);
CREATE INDEX idx_transactions_committee_id ON transactions(committee_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Users
CREATE POLICY "Users can view their own data" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users FOR UPDATE
  USING (auth.uid() = id);

-- Policies for Committees
CREATE POLICY "Anyone can view committees" ON committees FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create committees" ON committees FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = creator_id);

CREATE POLICY "Creators can update their committees" ON committees FOR UPDATE
  USING (auth.uid() = creator_id);

-- Policies for Committee Members
CREATE POLICY "Anyone can view committee members" ON committee_members FOR SELECT
  USING (true);

CREATE POLICY "Committee creators can insert members" ON committee_members FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT creator_id FROM committees WHERE id = committee_id)
  );

-- Policies for Transactions
CREATE POLICY "Anyone can view transactions" ON transactions FOR SELECT
  USING (true);

CREATE POLICY "Committee creators can insert transactions" ON transactions FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT creator_id FROM committees WHERE id = committee_id)
  );

CREATE POLICY "Authenticated users can update transactions" ON transactions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policies for Notifications
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications" ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
