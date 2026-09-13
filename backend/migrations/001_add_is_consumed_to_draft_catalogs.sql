-- Migration 001: Add is_consumed column to draft_catalogs table
ALTER TABLE draft_catalogs ADD COLUMN IF NOT EXISTS is_consumed BOOLEAN DEFAULT FALSE NOT NULL;
