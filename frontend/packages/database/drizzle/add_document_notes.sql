-- Create note_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type') THEN
        CREATE TYPE "public"."note_type" AS ENUM('anchored', 'document');
    END IF;
END
$$;

-- Create document_notes table
CREATE TABLE IF NOT EXISTS "document_notes" (
    "id" bigserial PRIMARY KEY NOT NULL,
    "document_id" bigint NOT NULL,
    "note_type" "note_type" NOT NULL,
    "anchor_start_offset" integer,
    "anchor_end_offset" integer,
    "anchor_text" text,
    "content" text NOT NULL,
    "author_name" varchar(255),
    "state" varchar(2) NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "document_notes_document_id_regulatory_documents_id_fk"
        FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade
);
