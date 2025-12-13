-- Migration: Add reviewer comment fields to red_flags table
-- Purpose: Enable tracking of red flag review status, reviewer notes, priority, and impact type
-- Date: 2025-12-10

ALTER TABLE red_flags ADD COLUMN review_status VARCHAR(50) DEFAULT 'unreviewed';
-- Status values: 'unreviewed', 'confirmed', 'false_positive', 'needs_context', 'deferred'

ALTER TABLE red_flags ADD COLUMN reviewed_by VARCHAR(255);
-- Name/ID of the reviewer who assessed this flag

ALTER TABLE red_flags ADD COLUMN reviewed_at TIMESTAMP;
-- When the flag was reviewed

ALTER TABLE red_flags ADD COLUMN reviewer_notes TEXT;
-- Detailed notes from the reviewer

ALTER TABLE red_flags ADD COLUMN priority INTEGER;
-- Priority ranking for "announce this one" - NULL if not prioritized

ALTER TABLE red_flags ADD COLUMN impact_type VARCHAR(100);
-- Type of impact: 'cost_savings', 'time_savings', 'accessibility', etc.

-- Indexes for common queries
CREATE INDEX idx_red_flags_review_status ON red_flags(review_status);
CREATE INDEX idx_red_flags_priority ON red_flags(priority) WHERE priority IS NOT NULL;
