CREATE TYPE "public"."note_type" AS ENUM('anchored', 'document');--> statement-breakpoint
CREATE TABLE "regulatory_documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_index" integer,
	"type" varchar(50) NOT NULL,
	"state" varchar(2),
	"title" text NOT NULL,
	"url" text,
	"url_type" varchar(50),
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"parent_id" bigint,
	"hierarchy_level" varchar(50),
	"hierarchy_path" text,
	"nycrr_title" integer,
	"nycrr_part" varchar(50),
	"nycrr_section" varchar(50),
	"njac_title" varchar(50),
	"njac_chapter" varchar(50),
	"njac_subchapter" varchar(100),
	"scraped_from_url" text,
	"direct_child_count" integer DEFAULT 0,
	"descendant_count" integer DEFAULT 0,
	"descendant_flag_count" integer DEFAULT 0,
	"descendant_max_severity" integer,
	"has_descendant_analysis" boolean DEFAULT false,
	"compliance_issue_count" integer DEFAULT 0,
	"descendant_compliance_issue_count" integer DEFAULT 0,
	CONSTRAINT "regulatory_documents_state_source_index_type_unique" UNIQUE("state","source_index","type")
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint NOT NULL,
	"analyzed_at" timestamp DEFAULT now(),
	"model_version" varchar(100),
	"has_implementation_issues" boolean DEFAULT false,
	"overall_complexity" varchar(10),
	"summary" text,
	"requires_technical_review" boolean DEFAULT false,
	"has_reporting_requirement" boolean DEFAULT false,
	"max_severity" integer,
	"num_flags" integer DEFAULT 0,
	"is_current" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "red_flags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"analysis_id" bigint NOT NULL,
	"category" varchar(100) NOT NULL,
	"explanation" text NOT NULL,
	"severity" integer NOT NULL,
	"complexity" varchar(20) NOT NULL,
	"matched_phrases" text[] DEFAULT '{}',
	"implementation_approach" text NOT NULL,
	"effort_estimate" varchar(255),
	"text_examples" text[] DEFAULT '{}',
	"review_status" varchar(50) DEFAULT 'unreviewed',
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"reviewer_notes" text,
	"priority" integer,
	"impact_type" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "compliance_issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint NOT NULL,
	"issue_type" varchar(50) NOT NULL,
	"term_matched" varchar(255),
	"context" text NOT NULL,
	"requirement_quote" text NOT NULL,
	"from_statute" boolean,
	"statute_citation" varchar(255),
	"llm_confirmed" boolean DEFAULT false,
	"review_status" varchar(50) DEFAULT 'unreviewed',
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"reviewer_notes" text,
	"priority" integer,
	"impact_type" varchar(100),
	"state" varchar(2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "statute_references" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint NOT NULL,
	"usc_citations" text,
	"cfr_citations" text,
	"public_laws" text,
	"acts" text,
	"state_title" varchar(100),
	"state_section" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "document_notes" (
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
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statute_references" ADD CONSTRAINT "statute_references_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_notes" ADD CONSTRAINT "document_notes_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;