-- Migration: Change tag column to tags array
-- Run this in Supabase SQL Editor

-- Step 1: Add new tags column as TEXT array
ALTER TABLE menu_items ADD COLUMN tags TEXT[];

-- Step 2: Migrate existing single tag data to tags array
UPDATE menu_items SET tags = ARRAY[tag] WHERE tag IS NOT NULL;

-- Step 3: Drop old tag column
ALTER TABLE menu_items DROP COLUMN tag;
