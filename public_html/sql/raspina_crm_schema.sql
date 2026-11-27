-- Raspina Unified CRM (16 Modules), Loyalty Club, Bots & Analytics Schema (MySQL 8.0 / MariaDB 10.6+)
-- Import directly via phpMyAdmin (No SSH or Terminal required)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  phone_e164 VARCHAR(16) NOT NULL UNIQUE,
  email VARCHAR(160) NULL,
  full_name VARCHAR(120) NOT NULL,
  birth_date DATE NULL,
  city VARCHAR(64) NOT NULL DEFAULT 'تهران',
  top_size VARCHAR(16) NULL,
  bottom_size VARCHAR(16) NULL,
  shoe_size VARCHAR(16) NULL,
  preferred_colors JSON NULL,
  disliked_colors JSON NULL,
  favorite_styles JSON NULL,
  rfm_score SMALLINT NOT NULL DEFAULT 0,
  overall_score SMALLINT NOT NULL DEFAULT 0,
  churn_risk_pct TINYINT NOT NULL DEFAULT 0,
  nps_latest TINYINT NULL,
  rfm_segment VARCHAR(32) NOT NULL DEFAULT 'New',
  annual_spend_toman BIGINT NOT NULL DEFAULT 0,
  lifetime_value_toman BIGINT NOT NULL DEFAULT 0,
  wallet_balance_toman BIGINT NOT NULL DEFAULT 0,
  sms_sent_this_week TINYINT NOT NULL DEFAULT 0,
  unsubscribed_marketing TINYINT(1) NOT NULL DEFAULT 0,
  last_purchase_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rfm_segment (rfm_segment),
  INDEX idx_city (city),
  INDEX idx_last_purchase (last_purchase_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_identities (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  channel ENUM('raspinashop','raspinaclothing','raspinaclothes','telegram','instagram','pos_hamedan','pos_tehran') NOT NULL,
  external_user_id VARCHAR(128) NOT NULL,
  username_or_handle VARCHAR(128) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_channel_ext (channel, external_user_id),
  INDEX idx_customer_id (customer_id),
  CONSTRAINT fk_identities_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_groups (
  id CHAR(36) PRIMARY KEY,
  family_name VARCHAR(120) NOT NULL,
  owner_customer_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_family_owner FOREIGN KEY (owner_customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL UNIQUE,
  family_group_id CHAR(36) NULL,
  tier_code ENUM('bronze','gold','platinum','vip_black') NOT NULL DEFAULT 'bronze',
  points_per_10k DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  points_balance INT NOT NULL DEFAULT 0,
  cashback_rate_pct DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  is_b2b_wholesale TINYINT(1) NOT NULL DEFAULT 0,
  referral_code VARCHAR(24) NOT NULL UNIQUE,
  points_expire_at DATETIME NULL,
  tier_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loyalty_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_loyalty_family FOREIGN KEY (family_group_id) REFERENCES family_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  source_site ENUM('raspinashop','raspinaclothing','raspinaclothes','pos_hamedan','pos_tehran') NOT NULL,
  external_order_id VARCHAR(64) NOT NULL,
  attribution_channel ENUM('instagram_dm','telegram_bot','direct_web','store_walkin') NOT NULL DEFAULT 'direct_web',
  items_summary VARCHAR(255) NULL,
  total_toman BIGINT NOT NULL,
  status ENUM('paid','shipped','delivered','returned','cancelled') NOT NULL DEFAULT 'paid',
  ordered_at DATETIME NOT NULL,
  UNIQUE KEY uq_site_order (source_site, external_order_id),
  INDEX idx_customer_ordered (customer_id, ordered_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id CHAR(36) PRIMARY KEY,
  loyalty_account_id CHAR(36) NOT NULL,
  tx_type ENUM('earn_purchase','earn_review','earn_ugc','earn_referral','earn_birthday','earn_profile','earn_challenge','earn_anniversary','redeem_reward','expire') NOT NULL,
  points_delta INT NOT NULL,
  source_order_id CHAR(36) NULL,
  voucher_code VARCHAR(32) NULL,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loyalty_created (loyalty_account_id, created_at),
  CONSTRAINT fk_tx_account FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_order FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products_catalog (
  id CHAR(36) PRIMARY KEY,
  sku_master VARCHAR(64) NOT NULL UNIQUE,
  category_slug VARCHAR(64) NOT NULL,
  category_title_fa VARCHAR(80) NOT NULL,
  title_fa VARCHAR(200) NOT NULL,
  price_toman BIGINT NOT NULL,
  sale_price_toman BIGINT NULL,
  canonical_url TEXT NOT NULL,
  instagram_media_id VARCHAR(64) NULL,
  attributes_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category_slug (category_slug),
  INDEX idx_ig_media_id (instagram_media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  stage_code ENUM('immediate_confirm','h24_nps','d7_review_ugc','d30_cross_sell','d90_winback','anniversary_2x') NOT NULL,
  scheduled_for DATETIME NOT NULL,
  status ENUM('pending','completed','escalated','skipped') NOT NULL DEFAULT 'pending',
  nps_score TINYINT NULL,
  notes TEXT NULL,
  INDEX idx_status_schedule (status, scheduled_for),
  CONSTRAINT fk_followup_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_followup_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) PRIMARY KEY,
  ticket_code VARCHAR(32) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  channel ENUM('web','telegram','instagram','phone','whatsapp') NOT NULL,
  category VARCHAR(64) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  first_reply_sla_hours SMALLINT NOT NULL,
  resolution_sla_hours SMALLINT NOT NULL,
  status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
  assignee VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_status (status, first_reply_sla_hours),
  CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rma_requests (
  id CHAR(36) PRIMARY KEY,
  rma_code VARCHAR(32) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  product_title VARCHAR(200) NOT NULL,
  reason VARCHAR(80) NOT NULL,
  refund_amount_toman BIGINT NOT NULL,
  refund_target ENUM('wallet','bank_card') NOT NULL DEFAULT 'wallet',
  status ENUM('pending_review','approved_pickup','refunded') NOT NULL DEFAULT 'pending_review',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rma_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_rma_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gift_cards (
  id CHAR(36) PRIMARY KEY,
  card_code VARCHAR(32) NOT NULL UNIQUE,
  occasion VARCHAR(40) NOT NULL,
  amount_toman BIGINT NOT NULL,
  recipient_phone VARCHAR(16) NOT NULL,
  delivery_channel ENUM('whatsapp','telegram') NOT NULL DEFAULT 'whatsapp',
  status ENUM('active','redeemed','expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_role VARCHAR(32) NOT NULL,
  action_text VARCHAR(255) NOT NULL,
  target_ref VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instagram_daily_metrics (
  id CHAR(36) PRIMARY KEY,
  metric_date DATE NOT NULL UNIQUE,
  followers_gained INT NOT NULL DEFAULT 0,
  followers_lost INT NOT NULL DEFAULT 0,
  reach_and_views INT NOT NULL DEFAULT 0,
  dm_inbound_count INT NOT NULL DEFAULT 0,
  avg_bot_reply_ms INT NOT NULL DEFAULT 0,
  ig_attributed_sales_toman BIGINT NOT NULL DEFAULT 0,
  ai_specialist_summary JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
