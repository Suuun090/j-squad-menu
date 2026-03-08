-- Migration: Change tag column to tags array
-- Run this in Supabase SQL Editor

-- Step 1: Add new tags column as TEXT array
ALTER TABLE menu_items ADD COLUMN tags TEXT[];

-- Step 2: Migrate existing single tag data to tags array
UPDATE menu_items SET tags = ARRAY[tag] WHERE tag IS NOT NULL;

-- Step 3: Drop old tag column
ALTER TABLE menu_items DROP COLUMN tag;

-- -----------------------------------------------
-- Migration: Add orders and order_selections tables
-- Run this in Supabase SQL Editor
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  person_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, menu_item_id, person_name)
);

-- Enable real-time for order_selections
ALTER PUBLICATION supabase_realtime ADD TABLE order_selections;
