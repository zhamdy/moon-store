-- Wave 3 Phase 5: AI - Chatbot & Support
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  session_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated')),
  escalated_to INTEGER REFERENCES users(id),
  metadata TEXT, -- JSON: user_agent, page, etc.
  created_at DATETIME DEFAULT (datetime('now')),
  closed_at DATETIME
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'bot', 'agent')),
  message TEXT NOT NULL,
  metadata TEXT, -- JSON: intent, confidence, product_refs
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Knowledge base for chatbot
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT, -- comma-separated
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Insert default FAQ entries
INSERT INTO knowledge_base (category, question, answer, keywords) VALUES
  ('shipping', 'What are the shipping options?', 'We offer standard shipping (3-5 days) and express shipping (1-2 days). Free shipping on orders over 500 SAR.', 'shipping,delivery,express,free'),
  ('returns', 'What is your return policy?', 'We accept returns within 14 days of delivery. Items must be in original condition with tags attached.', 'return,refund,exchange,policy'),
  ('payment', 'What payment methods do you accept?', 'We accept credit/debit cards, Apple Pay, and cash on delivery.', 'payment,card,cash,apple pay'),
  ('orders', 'How can I track my order?', 'You can track your order using the order number on our website. We will also send tracking updates via SMS.', 'track,order,status,tracking');
