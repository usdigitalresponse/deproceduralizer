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
	"nycrr_title_name" text,
	"nycrr_subtitle" varchar(50),
	"nycrr_subtitle_name" text,
	"nycrr_chapter" varchar(50),
	"nycrr_chapter_name" text,
	"nycrr_subchapter" varchar(50),
	"nycrr_subchapter_name" text,
	"nycrr_article" varchar(50),
	"nycrr_article_name" text,
	"nycrr_part" varchar(50),
	"nycrr_part_name" text,
	"nycrr_subpart" varchar(50),
	"nycrr_subpart_name" text,
	"nycrr_section" varchar(50),
	"nycrr_section_name" text,
	"njac_title" varchar(50),
	"njac_title_name" text,
	"njac_subtitle" varchar(50),
	"njac_subtitle_name" text,
	"njac_chapter" varchar(50),
	"njac_chapter_name" text,
	"njac_subchapter" varchar(100),
	"njac_subchapter_name" text,
	"njac_article" varchar(50),
	"njac_article_name" text,
	"njac_part" varchar(50),
	"njac_part_name" text,
	"njac_subpart" varchar(50),
	"njac_subpart_name" text,
	"njac_section" varchar(50),
	"njac_section_name" text,
	"njsa_title" varchar(10),
	"njsa_title_name" text,
	"njsa_chapter" varchar(20),
	"njsa_section" varchar(20),
	"njsa_section_name" text,
	"njsa_citation" varchar(50),
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
	"impact_type" varchar(100),
	"developer_status" varchar(50) DEFAULT 'unresolved',
	"developer_assigned" varchar(50),
	"developer_notes" text,
	"resolution_type" varchar(50),
	"resolution_comments" text,
	"developer_question" text,
	"developer_checked_at" timestamp
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
	"developer_status" varchar(50) DEFAULT 'unresolved',
	"developer_assigned" varchar(50),
	"developer_notes" text,
	"resolution_type" varchar(50),
	"resolution_comments" text,
	"developer_question" text,
	"developer_checked_at" timestamp,
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
CREATE TABLE "definitions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint,
	"url" text,
	"term" text NOT NULL,
	"definition" text NOT NULL,
	"scope" text,
	"definition_overlap" real DEFAULT 0,
	"source_location" text,
	"model_version" varchar(100),
	"extracted_at" timestamp DEFAULT now(),
	"notes" text,
	"scope_level" varchar(20),
	"scope_document_id" bigint,
	"definition_type" varchar(20) DEFAULT 'formal',
	"normalized_term" text,
	"is_cross_reference" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "regulation_statute_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"regulation_id" bigint NOT NULL,
	"statute_id" bigint NOT NULL,
	"citation" varchar(50) NOT NULL,
	"context" text,
	"link_type" varchar(50) DEFAULT 'reference',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "regulation_statute_links_regulation_id_statute_id_citation_unique" UNIQUE("regulation_id","statute_id","citation")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statute_references" ADD CONSTRAINT "statute_references_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_notes" ADD CONSTRAINT "document_notes_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definitions" ADD CONSTRAINT "definitions_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definitions" ADD CONSTRAINT "definitions_scope_document_id_regulatory_documents_id_fk" FOREIGN KEY ("scope_document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_statute_links" ADD CONSTRAINT "regulation_statute_links_regulation_id_regulatory_documents_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_statute_links" ADD CONSTRAINT "regulation_statute_links_statute_id_regulatory_documents_id_fk" FOREIGN KEY ("statute_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE no action;