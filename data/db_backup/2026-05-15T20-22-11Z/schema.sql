--
-- PostgreSQL database dump
--

\restrict uifdFwMvmj8Go4gSSEjogbPrqedmtqSXN3TEOCo1CHRDR1867mvXVhshphD2Wft

-- Dumped from database version 17.8 (9c8634e)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: ambiguity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambiguity_type AS ENUM (
    'multi_sku',
    'no_alias',
    'agency_internal',
    'no_fedramp'
);


--
-- Name: feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedback_type AS ENUM (
    'suggestion',
    'bug',
    'question',
    'other'
);


--
-- Name: note_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.note_type AS ENUM (
    'anchored',
    'document'
);


--
-- Name: queue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queue_status AS ENUM (
    'pending',
    'resolved',
    'rejected'
);


--
-- Name: token_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.token_source AS ENUM (
    'providers_detected',
    'free_text',
    'system_name'
);


--
-- Name: compliance_issue_analyses_search_vector_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compliance_issue_analyses_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', coalesce(NEW.tier2_reasoning, '')) ||
    to_tsvector('english', coalesce(NEW.tier3_reasoning, '')) ||
    to_tsvector('english', coalesce(array_to_string(NEW.verbatim_requirements, ' '), ''));
  RETURN NEW;
END;
$$;


--
-- Name: guidance_documents_search_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guidance_documents_search_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                          setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    NEW.updated_at := NOW();
    RETURN NEW;
END $$;


--
-- Name: jenai_issues_search_tsvector(text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jenai_issues_search_tsvector(explanation text, tags text[]) RETURNS tsvector
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT to_tsvector('english', coalesce(explanation, '') || ' ' || coalesce(array_to_string(tags, ' '), ''));
$$;


--
-- Name: natural_sort_alpha(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.natural_sort_alpha(text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT COALESCE(regexp_replace($1, '^[0-9]+', '', 'g'), '');
$_$;


--
-- Name: natural_sort_num(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.natural_sort_num(text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT COALESCE(
    NULLIF(regexp_replace($1, '[^0-9].*$', '', 'g'), '')::integer,
    0
  );
$_$;


--
-- Name: recalculate_jenai_burden(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_jenai_burden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_analysis_id BIGINT;
  new_composite REAL;
  new_cluster_count INTEGER;
BEGIN
  -- Determine which analysis_id to recalculate
  IF TG_OP = 'DELETE' THEN
    target_analysis_id := OLD.analysis_id;
  ELSE
    target_analysis_id := NEW.analysis_id;
  END IF;

  -- Recalculate from all issues for this analysis
  SELECT
    COALESCE(SUM(severity * confidence), 0),
    COUNT(DISTINCT category) FILTER (
      WHERE category IN (
        'ADMINISTRATIVE_BURDENS',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'REGULATORY_COMPLEXITY',
        'ONE_SIZE_FITS_ALL',
        'CASCADE_OF_RIGIDITY',
        'UNFUNDED_MANDATE'
      )
    )
  INTO new_composite, new_cluster_count
  FROM jenai_issues
  WHERE analysis_id = target_analysis_id;

  UPDATE jenai_analyses
  SET
    composite_burden = new_composite,
    structural_cluster_count = new_cluster_count,
    adjusted_burden = new_composite * (1 + 0.1 * new_cluster_count)
  WHERE id = target_analysis_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: regulatory_documents_search_vector_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regulatory_documents_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$;


--
-- Name: statutes_search_vector_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.statutes_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id bigint NOT NULL,
    jurisdiction character varying(3) NOT NULL,
    canonical_name text NOT NULL,
    abbreviation character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    level character varying(20),
    CONSTRAINT chk_agencies_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_agencies_level CHECK (((level IS NULL) OR ((level)::text = ANY ((ARRAY['federal'::character varying, 'state'::character varying, 'county'::character varying, 'city'::character varying, 'village'::character varying, 'town'::character varying, 'authority'::character varying, 'judiciary'::character varying, 'generic'::character varying])::text[]))))
);


--
-- Name: agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agencies_id_seq OWNED BY public.agencies.id;


--
-- Name: agency_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_aliases (
    id bigint NOT NULL,
    agency_id bigint NOT NULL,
    alias text NOT NULL,
    source character varying(50) DEFAULT 'manual'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: agency_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agency_aliases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agency_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agency_aliases_id_seq OWNED BY public.agency_aliases.id;


--
-- Name: bookmark_markers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmark_markers (
    id bigint NOT NULL,
    bookmark_id bigint NOT NULL,
    marker_group_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bookmark_markers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookmark_markers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookmark_markers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookmark_markers_id_seq OWNED BY public.bookmark_markers.id;


--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    id bigint NOT NULL,
    document_id bigint,
    analysis_id bigint,
    issue_type character varying(50),
    jurisdiction character varying(3) NOT NULL,
    notes text,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    guidance_document_id bigint,
    fine_id bigint,
    CONSTRAINT chk_bookmarks_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_bookmarks_source_type CHECK ((((fine_id IS NOT NULL) AND (document_id IS NULL) AND (guidance_document_id IS NULL)) OR ((fine_id IS NULL) AND ((document_id IS NOT NULL) OR (guidance_document_id IS NOT NULL)))))
);


--
-- Name: TABLE bookmarks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bookmarks IS 'User bookmarks for pipeline analyses and regulatory documents';


--
-- Name: COLUMN bookmarks.document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.document_id IS 'The regulatory document being bookmarked (always set)';


--
-- Name: COLUMN bookmarks.analysis_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.analysis_id IS 'The specific analysis being bookmarked (null for document-level bookmarks)';


--
-- Name: COLUMN bookmarks.issue_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.issue_type IS 'Denormalized from analysis for easier filtering';


--
-- Name: COLUMN bookmarks.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.notes IS 'Optional user notes explaining why this was bookmarked';


--
-- Name: COLUMN bookmarks.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.created_by IS 'Name of the user who created the bookmark';


--
-- Name: bookmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookmarks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookmarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookmarks_id_seq OWNED BY public.bookmarks.id;


--
-- Name: compliance_issue_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_issue_analyses (
    id bigint NOT NULL,
    document_id bigint,
    issue_type character varying(50) NOT NULL,
    jurisdiction character varying(3) NOT NULL,
    grouped_match_count integer NOT NULL,
    tier1_relevant_match_ids integer[] DEFAULT '{}'::integer[],
    tier1_dismissed_match_ids integer[] DEFAULT '{}'::integer[],
    tier1_dismissed_reasons jsonb,
    tier1_classification character varying(30),
    tier1_confidence real,
    tier1_reasoning text,
    tier1_context_requests jsonb,
    tier1_batch_id character varying(100),
    tier1_completed_at timestamp without time zone,
    tier2_classification character varying(30),
    tier2_confidence real,
    tier2_reasoning text,
    verbatim_requirements text[] DEFAULT '{}'::text[],
    severity integer,
    severity_baseline integer,
    severity_calculation text,
    argument_for_regulation text,
    argument_against_regulation text,
    context_used jsonb,
    tier2_full_text_requests jsonb,
    needs_web_search boolean DEFAULT false,
    web_search_topics text[] DEFAULT '{}'::text[],
    potentially_controversial boolean DEFAULT false,
    federal_mandate_suspected boolean DEFAULT false,
    ambiguity_type character varying(20),
    tier2_batch_id character varying(100),
    tier2_completed_at timestamp without time zone,
    tier3_classification character varying(30),
    tier3_confidence real,
    tier3_reasoning text,
    tier3_severity_adjustment integer,
    tier3_severity_adjustment_reasoning text,
    tier3_batch_id character varying(100),
    tier3_completed_at timestamp without time zone,
    web_search_summary text,
    requirement_found boolean,
    is_justified boolean DEFAULT false,
    is_verbatim boolean,
    final_severity integer,
    pipeline_version character varying(20) DEFAULT 'v4'::character varying,
    highest_tier_completed integer DEFAULT 0,
    classification_tier integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    federal_mandate_found boolean DEFAULT false,
    state_has_discretion boolean DEFAULT true,
    tier1_argument_framing jsonb,
    tier1_recommendations jsonb,
    tier2_rerun_count integer DEFAULT 0,
    tier2_context_requests_made jsonb,
    tier2_forced_classification boolean DEFAULT false,
    tier3_flags jsonb,
    tier3_evidence_gap boolean DEFAULT false,
    claims_no_alternative boolean DEFAULT false,
    cites_federal_statute boolean DEFAULT false,
    federal_citation text,
    easy_cleanup_candidate boolean DEFAULT false,
    cleanup_type character varying,
    cleanup_evidence text,
    cleanup_recommendation text,
    cleanup_effort character varying,
    tier3_trigger_reason text,
    program_context text,
    not_to_confuse_with text[] DEFAULT '{}'::text[],
    search_scope_guidance text,
    review_status character varying(50) DEFAULT 'unreviewed'::character varying,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    justification_notes text,
    team_notes text,
    impact_type character varying(100),
    reviewer_severity integer,
    reviewer_original_severity integer,
    developer_status character varying(50) DEFAULT 'unresolved'::character varying,
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    search_vector tsvector,
    guidance_document_id bigint,
    tier1_prompt_id bigint,
    tier2_prompt_id bigint,
    tier3_prompt_id bigint,
    responsible_agency text,
    primary_affected_population character varying(50),
    domain_relevance_score integer,
    reform_priority_score integer,
    report_serves_public boolean,
    report_duplicates_existing boolean,
    report_frequency_excessive boolean,
    review_summary text,
    CONSTRAINT chk_cia_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT cia_one_source CHECK (((((document_id IS NOT NULL))::integer + ((guidance_document_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT compliance_issue_analyses_cleanup_effort_check CHECK (((cleanup_effort IS NULL) OR ((cleanup_effort)::text = ANY ((ARRAY['trivial'::character varying, 'easy'::character varying, 'medium'::character varying])::text[])))),
    CONSTRAINT compliance_issue_analyses_cleanup_type_check CHECK (((cleanup_type IS NULL) OR ((cleanup_type)::text = ANY ((ARRAY['alternative_in_practice'::character varying, 'alternative_authorized'::character varying, 'peer_state_solution'::character varying])::text[])))),
    CONSTRAINT compliance_issue_analyses_highest_tier_completed_check CHECK (((highest_tier_completed >= 0) AND (highest_tier_completed <= 4))),
    CONSTRAINT compliance_issue_analyses_severity_check CHECK (((severity >= 1) AND (severity <= 10))),
    CONSTRAINT compliance_issue_analyses_tier2_rerun_count_check CHECK (((tier2_rerun_count >= 0) AND (tier2_rerun_count <= 2))),
    CONSTRAINT compliance_issue_analyses_tier3_severity_adjustment_check CHECK (((tier3_severity_adjustment >= '-3'::integer) AND (tier3_severity_adjustment <= 3)))
);


--
-- Name: TABLE compliance_issue_analyses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_issue_analyses IS 'Document-level analysis results for research pipeline. V4 uses 4-tier architecture (columns tier1-tier4). V5 uses 3-tier architecture with proactive context, argument framing, and re-runs. Use pipeline_version column to distinguish.';


--
-- Name: COLUMN compliance_issue_analyses.grouped_match_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.grouped_match_count IS 'Number of regex matches from compliance_issues table that were grouped and analyzed together';


--
-- Name: COLUMN compliance_issue_analyses.tier1_classification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier1_classification IS 'all_false_positives = all matches were false positives, needs_research = at least one match needs research';


--
-- Name: COLUMN compliance_issue_analyses.tier2_classification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier2_classification IS 'unrelated, justified, burdensome, or needs_full_context (requires Tier 3)';


--
-- Name: COLUMN compliance_issue_analyses.context_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.context_used IS 'JSONB array of context sources used: [{type, identifier, quote, relevance, source_id, ...}]';


--
-- Name: COLUMN compliance_issue_analyses.ambiguity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.ambiguity_type IS 'internal = need more state context (Tier 3), external = need federal verification (Tier 4), both = need both';


--
-- Name: COLUMN compliance_issue_analyses.classification_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.classification_tier IS 'Which tier made the final classification (1=all_false_positives, 2-4=terminal classification)';


--
-- Name: COLUMN compliance_issue_analyses.federal_mandate_found; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.federal_mandate_found IS 'True if web search confirmed a federal mandate requiring this regulation';


--
-- Name: COLUMN compliance_issue_analyses.state_has_discretion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.state_has_discretion IS 'True if state has discretion in how to implement the requirement';


--
-- Name: COLUMN compliance_issue_analyses.tier1_argument_framing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier1_argument_framing IS 'V5: Argument framing from Tier 1. Contains best_argument_burdensome, best_argument_justified, best_argument_unrelated. Only populated if classification=needs_research.';


--
-- Name: COLUMN compliance_issue_analyses.tier1_recommendations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier1_recommendations IS 'V5: Tier 1 context requests for Tier 2 to fetch. Contains context_requests array [{context_type, identifier, need_level, reason}, ...].';


--
-- Name: COLUMN compliance_issue_analyses.tier2_rerun_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier2_rerun_count IS 'V5: Number of times Tier 2 was re-run with additional context. Max 2.';


--
-- Name: COLUMN compliance_issue_analyses.tier2_context_requests_made; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier2_context_requests_made IS 'V5: Array of context requests made during re-runs. Each entry: {context_type, identifier, need_level, reason, timestamp}.';


--
-- Name: COLUMN compliance_issue_analyses.tier2_forced_classification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier2_forced_classification IS 'V5: True if classification was forced after exceeding max re-runs (2). Indicates lower confidence.';


--
-- Name: COLUMN compliance_issue_analyses.tier3_flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier3_flags IS 'V5: Structured verification flags with evidence. Contains superseded_by_law, federal_mandate_confirmed, state_discretion_found, modernized_alternative_found. Each is an EvidencedFlag with value, scope, reason, and evidence array.';


--
-- Name: COLUMN compliance_issue_analyses.tier3_evidence_gap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier3_evidence_gap IS 'V5: True if Tier 3 web search found no relevant evidence. Indicates lower confidence in external verification.';


--
-- Name: COLUMN compliance_issue_analyses.claims_no_alternative; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.claims_no_alternative IS 'V5: True if Tier 2 claims there is no electronic/remote alternative. Triggers Tier 3 if severity >= 7.';


--
-- Name: COLUMN compliance_issue_analyses.cites_federal_statute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.cites_federal_statute IS 'V5: True if document cites a federal statute. Triggers Tier 3 for verification.';


--
-- Name: COLUMN compliance_issue_analyses.federal_citation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.federal_citation IS 'V5: The federal citation found (e.g., "42 CFR 483.24"). NULL if cites_federal_statute is false.';


--
-- Name: COLUMN compliance_issue_analyses.easy_cleanup_candidate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.easy_cleanup_candidate IS 'True if this is a low-hanging fruit cleanup opportunity';


--
-- Name: COLUMN compliance_issue_analyses.cleanup_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.cleanup_type IS 'Type: alternative_in_practice, alternative_authorized, peer_state_solution';


--
-- Name: COLUMN compliance_issue_analyses.cleanup_evidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.cleanup_evidence IS 'URL or citation proving the alternative exists';


--
-- Name: COLUMN compliance_issue_analyses.cleanup_recommendation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.cleanup_recommendation IS 'Specific suggested regulation text change';


--
-- Name: COLUMN compliance_issue_analyses.cleanup_effort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.cleanup_effort IS 'Effort level: trivial, easy, or medium';


--
-- Name: COLUMN compliance_issue_analyses.tier3_trigger_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.tier3_trigger_reason IS 'Human-readable reason for Tier 3 escalation (e.g., "High-risk issue type (notarization) + justified", "Random sample (10%)", "Low confidence (0.82) + severity 7")';


--
-- Name: COLUMN compliance_issue_analyses.program_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.program_context IS 'V5.2: Specific program/agency context for web search disambiguation';


--
-- Name: COLUMN compliance_issue_analyses.not_to_confuse_with; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.not_to_confuse_with IS 'V5.2: List of similar-sounding programs that Tier 3 should NOT treat as relevant';


--
-- Name: COLUMN compliance_issue_analyses.search_scope_guidance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analyses.search_scope_guidance IS 'V5.2: Guidance for Tier 3 on what to focus on vs avoid in web searches';


--
-- Name: compliance_issue_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compliance_issue_analyses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compliance_issue_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compliance_issue_analyses_id_seq OWNED BY public.compliance_issue_analyses.id;


--
-- Name: compliance_issue_analysis_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_issue_analysis_reviews (
    id bigint NOT NULL,
    analysis_id bigint NOT NULL,
    tier integer,
    review_status character varying(50) DEFAULT 'unreviewed'::character varying NOT NULL,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    justification_notes text,
    team_notes text,
    override_classification character varying(30),
    override_severity integer,
    override_reasoning text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT compliance_issue_analysis_reviews_override_severity_check CHECK (((override_severity IS NULL) OR ((override_severity >= 1) AND (override_severity <= 10)))),
    CONSTRAINT compliance_issue_analysis_reviews_tier_check CHECK (((tier IS NULL) OR ((tier >= 1) AND (tier <= 3))))
);


--
-- Name: TABLE compliance_issue_analysis_reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_issue_analysis_reviews IS 'Reviews for compliance_issue_analyses. tier=NULL is per-analysis review, tier=1/2/3 is per-tier review.';


--
-- Name: COLUMN compliance_issue_analysis_reviews.tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analysis_reviews.tier IS 'NULL = review applies to whole analysis. 1/2/3 = review applies to specific tier output.';


--
-- Name: COLUMN compliance_issue_analysis_reviews.override_classification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issue_analysis_reviews.override_classification IS 'Reviewer override of LLM classification (unrelated/justified/burdensome)';


--
-- Name: compliance_issue_analysis_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compliance_issue_analysis_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compliance_issue_analysis_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compliance_issue_analysis_reviews_id_seq OWNED BY public.compliance_issue_analysis_reviews.id;


--
-- Name: compliance_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_issues (
    id bigint NOT NULL,
    document_id bigint,
    issue_type character varying(50) NOT NULL,
    url text,
    jurisdiction character varying(3) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    occurrence_number integer DEFAULT 1 NOT NULL,
    regex_match_pattern character varying(255),
    regex_match_context text NOT NULL,
    analysis_id bigint,
    run_id character varying(32),
    guidance_document_id bigint,
    CONSTRAINT chk_ci_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT compliance_issues_one_source CHECK (((((document_id IS NOT NULL))::integer + ((guidance_document_id IS NOT NULL))::integer) = 1))
);


--
-- Name: COLUMN compliance_issues.regex_match_pattern; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issues.regex_match_pattern IS 'New: Regex pattern that triggered scan (mirrors matched_pattern)';


--
-- Name: COLUMN compliance_issues.regex_match_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issues.regex_match_context IS 'New: Text window around the regex match (mirrors matched_context)';


--
-- Name: COLUMN compliance_issues.run_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_issues.run_id IS 'Pipeline run identifier for tracking which run produced this issue';


--
-- Name: compliance_issues_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_issues_archive (
    id bigint,
    document_id bigint,
    issue_type character varying(50),
    matched_pattern character varying(255),
    matched_context text,
    url text,
    requirement_found boolean,
    requirement_text text,
    required_by_statute boolean,
    severity integer,
    impact_assessment text,
    review_status character varying(50),
    developer_status character varying(50),
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    state character varying(2),
    created_at timestamp without time zone,
    occurrence_number integer,
    statute_citation character varying(255),
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    justification_notes text,
    impact_type character varying(100),
    team_notes text,
    is_verbatim boolean,
    original_severity integer,
    archived_at timestamp with time zone,
    archive_reason text
);


--
-- Name: compliance_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compliance_issues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compliance_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compliance_issues_id_seq OWNED BY public.compliance_issues.id;


--
-- Name: cross_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cross_references (
    id bigint NOT NULL,
    source_document_id bigint,
    ref_type character varying(50) NOT NULL,
    raw_text text NOT NULL,
    normalized_citation text NOT NULL,
    start_offset integer,
    end_offset integer,
    context_before text,
    context_after text,
    components jsonb,
    target_document_id bigint,
    is_resolved boolean DEFAULT false,
    resolution_notes text,
    jurisdiction character varying(3) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_jurisdiction character varying(3) NOT NULL,
    target_jurisdiction character varying(3),
    source_guidance_id bigint,
    target_guidance_id bigint,
    CONSTRAINT chk_cr_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_crossref_source CHECK (((((source_document_id IS NOT NULL))::integer + ((source_guidance_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT chk_crossref_source_jurisdiction CHECK (((source_jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_crossref_target CHECK (((((target_document_id IS NOT NULL))::integer + ((target_guidance_id IS NOT NULL))::integer) <= 1)),
    CONSTRAINT chk_crossref_target_jurisdiction CHECK (((target_jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[])))
);


--
-- Name: TABLE cross_references; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cross_references IS 'Internal cross-references between regulatory documents. Stores citations like "18 NYCRR 505.14" or "section 624.8 of this Part" found in regulation text.';


--
-- Name: COLUMN cross_references.ref_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cross_references.ref_type IS 'Type of reference: nycrr (full-form NY), njac (full-form NJ), ny_short_form (context-dependent NY), same_section (internal)';


--
-- Name: COLUMN cross_references.resolution_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cross_references.resolution_notes IS 'For unresolved references: explains why resolution failed (e.g., "Target section not found in database")';


--
-- Name: cross_references_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cross_references_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cross_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cross_references_id_seq OWNED BY public.cross_references.id;


--
-- Name: definition_document_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.definition_document_occurrences (
    definition_id bigint NOT NULL,
    document_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.definitions (
    id bigint NOT NULL,
    term text NOT NULL,
    verbatim_text text NOT NULL,
    scope text,
    definition_overlap double precision DEFAULT 0.0,
    source_location text,
    model_version character varying(100),
    extracted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    url text NOT NULL,
    document_id bigint,
    scope_level character varying(20),
    scope_document_id bigint,
    definition_type character varying(20) DEFAULT 'formal'::character varying,
    normalized_term text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM term))) STORED,
    is_cross_reference boolean DEFAULT false,
    is_verbatim_text_complete boolean DEFAULT true,
    rephrased_definition text,
    review_status character varying(50) DEFAULT 'unreviewed'::character varying,
    reviewed_at timestamp without time zone,
    reviewer_name character varying(255),
    justification_notes text,
    team_notes text,
    original_values jsonb,
    developer_status character varying(50) DEFAULT 'unresolved'::character varying,
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    reference_completeness character varying(20),
    reference_target character varying(30),
    CONSTRAINT chk_reference_completeness CHECK (((reference_completeness IS NULL) OR ((reference_completeness)::text = ANY ((ARRAY['pure_pointer'::character varying, 'hybrid'::character varying])::text[])))),
    CONSTRAINT chk_reference_target CHECK (((reference_target IS NULL) OR ((reference_target)::text = ANY ((ARRAY['same_corpus'::character varying, 'federal'::character varying, 'external_standard'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT definitions_review_status_check CHECK (((review_status)::text = ANY ((ARRAY['unreviewed'::character varying, 'confirmed'::character varying, 'corrected'::character varying, 'false_positive'::character varying])::text[])))
);


--
-- Name: COLUMN definitions.is_verbatim_text_complete; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.is_verbatim_text_complete IS 'True if verbatim_text is a complete, usable definition on its own';


--
-- Name: COLUMN definitions.developer_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.developer_status IS 'Developer tracking status: unresolved, resolved, pending, backlogged, need_more_info';


--
-- Name: COLUMN definitions.developer_assigned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.developer_assigned IS 'Developer assigned to this definition';


--
-- Name: COLUMN definitions.developer_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.developer_notes IS 'Internal notes from developer';


--
-- Name: COLUMN definitions.resolution_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.resolution_type IS 'How the definition was resolved: implemented, not_implemented';


--
-- Name: COLUMN definitions.resolution_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.resolution_comments IS 'Details about the resolution';


--
-- Name: COLUMN definitions.developer_question; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.developer_question IS 'Question for reviewer when status is need_more_info';


--
-- Name: COLUMN definitions.developer_checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.developer_checked_at IS 'When developer last updated this record';


--
-- Name: COLUMN definitions.reference_completeness; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.reference_completeness IS 'pure_pointer = no inline definition (just pointer), hybrid = has inline definition plus reference';


--
-- Name: COLUMN definitions.reference_target; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.definitions.reference_target IS 'Where the reference points: same_corpus (NJ/NY regs), federal (CFR/USC), external_standard (industry orgs), other';


--
-- Name: definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.definitions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.definitions_id_seq OWNED BY public.definitions.id;


--
-- Name: regulatory_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulatory_documents (
    id bigint NOT NULL,
    source_index integer,
    type character varying(50) NOT NULL,
    jurisdiction character varying(3),
    title text NOT NULL,
    url text,
    url_type character varying(50),
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_id bigint,
    hierarchy_level character varying(50),
    hierarchy_path text,
    nycrr_title integer,
    nycrr_part character varying(50),
    nycrr_section character varying(50),
    nycrr_subpart character varying(50),
    nycrr_title_name text,
    nycrr_subtitle character varying(50),
    nycrr_subtitle_name text,
    nycrr_chapter character varying(50),
    nycrr_chapter_name text,
    nycrr_subchapter character varying(50),
    nycrr_subchapter_name text,
    nycrr_article character varying(50),
    nycrr_article_name text,
    nycrr_part_name text,
    nycrr_subpart_name text,
    nycrr_section_name text,
    scraped_from_url text,
    njac_title character varying(50),
    njac_title_name text,
    njac_subtitle character varying(50),
    njac_subtitle_name text,
    njac_chapter character varying(50),
    njac_chapter_name text,
    njac_subchapter character varying(50),
    njac_subchapter_name text,
    njac_article character varying(50),
    njac_article_name text,
    njac_part character varying(50),
    njac_part_name text,
    njac_subpart character varying(50),
    njac_subpart_name text,
    njac_section character varying(50),
    njac_section_name text,
    direct_child_count integer DEFAULT 0,
    descendant_count integer DEFAULT 0,
    compliance_issue_count integer DEFAULT 0,
    descendant_compliance_issue_count integer DEFAULT 0,
    njsa_title character varying(10),
    njsa_title_name text,
    njsa_chapter character varying(20),
    njsa_section character varying(20),
    njsa_section_name text,
    njsa_citation character varying(50),
    short_title text,
    level_identifier text,
    citation text,
    regulatory_status character varying(20) DEFAULT 'active'::character varying,
    recodified_to character varying(100),
    exclude_from_analysis boolean DEFAULT false,
    excluded_at timestamp without time zone,
    excluded_by character varying(255),
    excluded_reason text,
    cross_reference_count integer DEFAULT 0,
    summary text,
    section_type character varying(50),
    keywords text[] DEFAULT '{}'::text[],
    applies_to text[] DEFAULT '{}'::text[],
    has_form boolean DEFAULT false,
    has_ibr boolean DEFAULT false,
    search_vector tsvector,
    rcny_title character varying(20),
    rcny_title_name text,
    rcny_chapter character varying(20),
    rcny_chapter_name text,
    rcny_section character varying(50),
    rcny_section_name text,
    CONSTRAINT chk_rd_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[])))
);


--
-- Name: COLUMN regulatory_documents.summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.summary IS 'AI-generated 1-2 sentence summary of the section content';


--
-- Name: COLUMN regulatory_documents.section_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.section_type IS 'Category: definitions, requirements, procedures, prohibitions, standards, eligibility, penalties, fees, forms, reporting, scope, exemptions, reserved';


--
-- Name: COLUMN regulatory_documents.keywords; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.keywords IS 'Array of 3-5 searchable keywords extracted by AI';


--
-- Name: COLUMN regulatory_documents.applies_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.applies_to IS 'Array of entities that must comply (e.g., licensees, employers, applicants)';


--
-- Name: COLUMN regulatory_documents.has_form; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.has_form IS 'True if section references a specific form';


--
-- Name: COLUMN regulatory_documents.has_ibr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.regulatory_documents.has_ibr IS 'True if section incorporates external standards by reference (ASTM, NFPA, ISO, etc.)';


--
-- Name: document_hierarchy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.document_hierarchy AS
 SELECT p.id AS parent_id,
    p.title AS parent_title,
    p.hierarchy_level AS parent_level,
    c.id AS child_id,
    c.title AS child_title,
    c.hierarchy_level AS child_level
   FROM (public.regulatory_documents p
     JOIN public.regulatory_documents c ON ((c.parent_id = p.id)));


--
-- Name: document_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_notes (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    note_type public.note_type NOT NULL,
    anchor_start_offset integer,
    anchor_end_offset integer,
    anchor_text text,
    content text NOT NULL,
    author_name character varying(255),
    jurisdiction character varying(3) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_document_notes_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[])))
);


--
-- Name: document_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_notes_id_seq OWNED BY public.document_notes.id;


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    tag character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by character varying(100)
);


--
-- Name: document_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_tags_id_seq OWNED BY public.document_tags.id;


--
-- Name: domain_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_analyses (
    id integer NOT NULL,
    domain text NOT NULL,
    overall_summary text DEFAULT ''::text NOT NULL,
    total_findings integer DEFAULT 0 NOT NULL,
    analysis jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: domain_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.domain_analyses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: domain_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.domain_analyses_id_seq OWNED BY public.domain_analyses.id;


--
-- Name: eval_human_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_human_votes (
    id integer NOT NULL,
    eval_result_a_id integer NOT NULL,
    eval_result_b_id integer NOT NULL,
    document_id integer NOT NULL,
    preference text NOT NULL,
    reviewer_notes text,
    voted_at timestamp with time zone DEFAULT now()
);


--
-- Name: eval_human_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eval_human_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eval_human_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eval_human_votes_id_seq OWNED BY public.eval_human_votes.id;


--
-- Name: eval_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_results (
    id integer NOT NULL,
    eval_run_id integer NOT NULL,
    document_id integer NOT NULL,
    issue_type text,
    pipeline text NOT NULL,
    classification text,
    confidence real,
    severity integer,
    categories_found text[],
    federal_mandate_suspected boolean,
    needs_web_search boolean,
    easy_cleanup_candidate boolean,
    full_output jsonb,
    reasoning text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: eval_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eval_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eval_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eval_results_id_seq OWNED BY public.eval_results.id;


--
-- Name: eval_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_runs (
    id integer NOT NULL,
    run_id uuid DEFAULT gen_random_uuid(),
    pipeline text NOT NULL,
    model text NOT NULL,
    jurisdiction text NOT NULL,
    title_number text,
    config jsonb,
    document_count integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    cost_estimate_usd numeric(10,4),
    notes text
);


--
-- Name: eval_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eval_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eval_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eval_runs_id_seq OWNED BY public.eval_runs.id;


--
-- Name: fines_fees_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fines_fees_penalties (
    id bigint NOT NULL,
    document_id bigint,
    guidance_document_id bigint,
    penalty_type character varying(50) NOT NULL,
    amount text,
    amount_min numeric(12,2),
    amount_max numeric(12,2),
    per_unit text,
    who_pays text,
    responsible_agency text,
    violation_description text,
    requirement_quote text,
    context text NOT NULL,
    term_matched text,
    llm_confirmed boolean DEFAULT false,
    jurisdiction character varying(3) NOT NULL,
    url text,
    review_status character varying(50) DEFAULT 'unreviewed'::character varying,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    team_notes text,
    priority integer,
    developer_status character varying(50) DEFAULT 'unresolved'::character varying,
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    jurisdiction_level character varying(20),
    jurisdiction_level_other text,
    issuing_entity_confidence numeric(3,2),
    agency_id bigint,
    activity_category character varying(50),
    estimated_annual_payers character varying(20),
    justification text,
    who_pays_normalized character varying(40),
    justification_quote text,
    CONSTRAINT chk_fines_entity_confidence CHECK (((issuing_entity_confidence IS NULL) OR ((issuing_entity_confidence >= (0)::numeric) AND (issuing_entity_confidence <= (1)::numeric)))),
    CONSTRAINT chk_fines_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_fines_jurisdiction_level CHECK (((jurisdiction_level IS NULL) OR ((jurisdiction_level)::text = ANY ((ARRAY['federal'::character varying, 'state'::character varying, 'county'::character varying, 'local'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT chk_fines_who_pays_normalized CHECK (((who_pays_normalized IS NULL) OR ((who_pays_normalized)::text = ANY ((ARRAY['licensed_or_permitted'::character varying, 'applicant'::character varying, 'individual_or_household'::character varying, 'vehicle_or_vessel_operator'::character varying, 'business_or_corporation'::character varying, 'insurance_or_financial'::character varying, 'service_provider_or_operator'::character varying, 'healthcare_or_care_facility'::character varying, 'violator_or_respondent'::character varying, 'property_owner'::character varying, 'government_entity'::character varying, 'employer_or_employee'::character varying, 'student_or_educational'::character varying, 'taxpayer'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT fines_one_source_check CHECK ((((document_id IS NOT NULL) AND (guidance_document_id IS NULL)) OR ((document_id IS NULL) AND (guidance_document_id IS NOT NULL))))
);


--
-- Name: fines_fees_penalties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fines_fees_penalties_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fines_fees_penalties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fines_fees_penalties_id_seq OWNED BY public.fines_fees_penalties.id;


--
-- Name: guidance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guidance_documents (
    id bigint NOT NULL,
    catalog_id text,
    canonical_ref text,
    title text NOT NULL,
    agency text NOT NULL,
    agency_division text,
    doc_type text,
    domain text,
    date_published date,
    date_effective date,
    date_revised date,
    date_expires date,
    year integer,
    content text,
    url text,
    file_format text,
    status text DEFAULT 'active'::text,
    supersedes text[],
    superseded_by text,
    revision_of text,
    sender_name text,
    sender_title text,
    distribution_to text[],
    programs text[],
    cites_regulations text[],
    cites_federal text[],
    cites_documents text[],
    source_project text,
    text_path text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector,
    is_attachment boolean DEFAULT false,
    policy_category text,
    jurisdiction character varying(3) NOT NULL,
    summary text,
    section_type character varying(50),
    keywords text[],
    applies_to text[],
    has_form boolean DEFAULT false,
    has_ibr boolean DEFAULT false,
    target_audience text[] DEFAULT '{}'::text[],
    is_application boolean DEFAULT false,
    audience_direction character varying(20),
    audience_expertise character varying(20),
    audience_explanation text,
    flesch_kincaid_grade real,
    flesch_reading_ease real,
    gunning_fog real,
    automated_readability_index real,
    coleman_liau_index real,
    smog_index real,
    dale_chall_readability_score real,
    linsear_write_formula real,
    reading_grade_level character varying(50),
    difficult_word_count integer,
    word_count integer,
    sentence_count integer,
    exclude_from_analysis boolean DEFAULT false,
    excluded_at timestamp without time zone,
    excluded_by character varying(255),
    excluded_reason text,
    CONSTRAINT chk_gd_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[])))
);


--
-- Name: TABLE guidance_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.guidance_documents IS 'Sub-regulatory guidance documents (ADMs, LCMs, INFs, GIS, TSBs, etc.) from NY state agencies. Imported from the nys-documents catalog.';


--
-- Name: COLUMN guidance_documents.catalog_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guidance_documents.catalog_id IS 'ID from the nys-documents enriched_catalog.json (e.g. "00370")';


--
-- Name: COLUMN guidance_documents.canonical_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guidance_documents.canonical_ref IS 'Standard document reference (e.g. "23-OCFS-ADM-15-R1")';


--
-- Name: COLUMN guidance_documents.is_attachment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guidance_documents.is_attachment IS 'True if title matches attachment/enclosure/appendix patterns';


--
-- Name: COLUMN guidance_documents.policy_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guidance_documents.policy_category IS 'Rule-based category: policy_directive, legal_interpretation, tax_guidance, informational, reference_material, non_policy, data_dump, unclassified';


--
-- Name: guidance_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.guidance_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guidance_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.guidance_documents_id_seq OWNED BY public.guidance_documents.id;


--
-- Name: incorporations_by_reference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incorporations_by_reference (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    incorporated_document text,
    source_organization character varying(100),
    version text,
    requirement_quote text,
    term_matched character varying(255),
    context text NOT NULL,
    llm_confirmed boolean DEFAULT false,
    jurisdiction character varying(3) NOT NULL,
    url text NOT NULL,
    review_status character varying(50) DEFAULT 'unreviewed'::character varying,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    justification_notes text,
    team_notes text,
    priority integer,
    developer_status character varying(50) DEFAULT 'unresolved'::character varying,
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ibr_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT chk_ibr_resolution_type CHECK (((resolution_type)::text = ANY ((ARRAY['implemented'::character varying, 'not_implemented'::character varying])::text[])))
);


--
-- Name: incorporations_by_reference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incorporations_by_reference_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incorporations_by_reference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incorporations_by_reference_id_seq OWNED BY public.incorporations_by_reference.id;


--
-- Name: jenai_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jenai_analyses (
    id bigint NOT NULL,
    document_id bigint,
    jurisdiction character varying(3) NOT NULL,
    run_id character varying(32),
    has_implementation_issues boolean,
    overall_complexity character varying(10),
    summary text,
    max_severity integer,
    num_categories_found integer,
    pipeline_version character varying(20),
    model_version character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    batch_id character varying(100),
    completed_at timestamp without time zone,
    classification character varying(30),
    confidence real,
    categories jsonb,
    guidance_document_id bigint,
    responsible_agency text,
    composite_burden real,
    structural_cluster_count integer,
    adjusted_burden real,
    CONSTRAINT chk_jenai_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[]))),
    CONSTRAINT jenai_analyses_one_source_check CHECK ((((document_id IS NOT NULL) AND (guidance_document_id IS NULL)) OR ((document_id IS NULL) AND (guidance_document_id IS NOT NULL))))
);


--
-- Name: jenai_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jenai_analyses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jenai_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jenai_analyses_id_seq OWNED BY public.jenai_analyses.id;


--
-- Name: jenai_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jenai_issues (
    id bigint NOT NULL,
    analysis_id bigint NOT NULL,
    document_id bigint,
    category character varying(50) NOT NULL,
    explanation text NOT NULL,
    severity integer NOT NULL,
    complexity character varying(20) NOT NULL,
    confidence real NOT NULL,
    matched_phrases text[] DEFAULT '{}'::text[],
    implementation_approach text,
    effort_estimate text,
    text_examples text[] DEFAULT '{}'::text[],
    review_status character varying(50) DEFAULT 'unreviewed'::character varying,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    justification_notes text,
    team_notes text,
    priority integer,
    impact_type character varying(100),
    developer_status character varying(50) DEFAULT 'unresolved'::character varying,
    developer_assigned character varying(50),
    developer_notes text,
    resolution_type character varying(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[],
    is_verbatim boolean,
    guidance_document_id bigint,
    topics text[] DEFAULT '{}'::text[],
    CONSTRAINT jenai_issues_category_check CHECK (((category)::text = ANY ((ARRAY['REGULATORY_COMPLEXITY'::character varying, 'POLICY_IMPLEMENTATION_SEPARATION'::character varying, 'CASCADE_OF_RIGIDITY'::character varying, 'MANDATED_STEPS_NOT_OUTCOMES'::character varying, 'ADMINISTRATIVE_BURDENS'::character varying, 'NO_FEEDBACK_LOOPS'::character varying, 'PROCESS_WORSHIP_OVERSIGHT'::character varying, 'ZERO_RISK_LANGUAGE'::character varying, 'FROZEN_TECHNOLOGY'::character varying, 'OTHER'::character varying, 'MISSING_OUTCOMES'::character varying, 'UNCLEAR_DELEGATION'::character varying, 'ACCESS_ASSUMPTION_BARRIERS'::character varying, 'FEE_COST_BURDENS'::character varying, 'DEAD_SUPERSEDED_REFERENCES'::character varying, 'MISSING_DIGITAL_AUTHORIZATION'::character varying, 'ONE_SIZE_FITS_ALL'::character varying, 'UNFUNDED_MANDATE'::character varying])::text[]))),
    CONSTRAINT jenai_issues_confidence_check CHECK (((confidence >= (0.0)::double precision) AND (confidence <= (1.0)::double precision))),
    CONSTRAINT jenai_issues_one_source_check CHECK ((((document_id IS NOT NULL) AND (guidance_document_id IS NULL)) OR ((document_id IS NULL) AND (guidance_document_id IS NOT NULL)))),
    CONSTRAINT jenai_issues_severity_check CHECK (((severity >= 1) AND (severity <= 10)))
);


--
-- Name: jenai_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jenai_issues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jenai_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jenai_issues_id_seq OWNED BY public.jenai_issues.id;


--
-- Name: llm_api_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_api_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_hash text NOT NULL,
    pipeline text,
    tier integer,
    document_id bigint,
    model text NOT NULL,
    request_body jsonb NOT NULL,
    response_body jsonb NOT NULL,
    input_tokens integer,
    output_tokens integer,
    cache_read_tokens integer,
    cache_write_tokens integer,
    stale_after timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    prompt_hash text
);


--
-- Name: marker_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marker_groups (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6b7280'::character varying NOT NULL,
    icon character varying(50),
    jurisdiction character varying(3),
    sort_order integer DEFAULT 0 NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category character varying(30)
);


--
-- Name: marker_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marker_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marker_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marker_groups_id_seq OWNED BY public.marker_groups.id;


--
-- Name: prompt_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_feedback (
    id bigint NOT NULL,
    prompt_name character varying(100) NOT NULL,
    feedback_type public.feedback_type NOT NULL,
    content text NOT NULL,
    highlighted_text text,
    author_name character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: prompt_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prompt_feedback_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prompt_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prompt_feedback_id_seq OWNED BY public.prompt_feedback.id;


--
-- Name: prompt_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_templates (
    id bigint NOT NULL,
    content_hash text NOT NULL,
    pipeline text NOT NULL,
    tier integer,
    model text NOT NULL,
    system_prompt text,
    user_message text,
    tools_schema jsonb,
    full_request jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: prompt_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prompt_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prompt_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prompt_templates_id_seq OWNED BY public.prompt_templates.id;


--
-- Name: regulation_statute_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulation_statute_links (
    id bigint NOT NULL,
    regulation_id bigint NOT NULL,
    statute_id bigint,
    citation character varying(50) NOT NULL,
    context text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    match_status character varying(50) DEFAULT 'matched'::character varying,
    original_citation character varying(50),
    correction_notes text,
    reviewed_at timestamp without time zone,
    reviewed_by character varying(255),
    link_type character varying(50) DEFAULT 'reference'::character varying
);


--
-- Name: regulation_statute_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulation_statute_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulation_statute_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulation_statute_links_id_seq OWNED BY public.regulation_statute_links.id;


--
-- Name: regulatory_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulatory_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulatory_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulatory_documents_id_seq OWNED BY public.regulatory_documents.id;


--
-- Name: share_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    used_at timestamp without time zone
);


--
-- Name: TABLE share_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.share_tokens IS 'One-time shareable authentication tokens for granting temporary site access';


--
-- Name: COLUMN share_tokens.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.share_tokens.token IS 'Cryptographically random 64-character hex string';


--
-- Name: COLUMN share_tokens.used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.share_tokens.used IS 'Whether this token has been consumed';


--
-- Name: COLUMN share_tokens.used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.share_tokens.used_at IS 'Timestamp when token was first used';


--
-- Name: share_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.share_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: share_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.share_tokens_id_seq OWNED BY public.share_tokens.id;


--
-- Name: statute_mandate_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statute_mandate_checks (
    id bigint NOT NULL,
    analysis_id bigint NOT NULL,
    statute_id bigint NOT NULL,
    link_id bigint,
    statute_mandated boolean NOT NULL,
    confidence real NOT NULL,
    reasoning text NOT NULL,
    statute_text_excerpt text,
    model character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: statute_mandate_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statute_mandate_checks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: statute_mandate_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statute_mandate_checks_id_seq OWNED BY public.statute_mandate_checks.id;


--
-- Name: statute_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statute_references (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    usc_citations text,
    cfr_citations text,
    public_laws text,
    acts text,
    state_title character varying(100),
    state_section character varying(100)
);


--
-- Name: statute_references_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statute_references_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: statute_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statute_references_id_seq OWNED BY public.statute_references.id;


--
-- Name: statutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statutes (
    id bigint NOT NULL,
    citation character varying(50) NOT NULL,
    jurisdiction character varying(3) DEFAULT 'NJ'::character varying NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    njsa_title character varying(10),
    njsa_title_name text,
    njsa_chapter character varying(20),
    njsa_section character varying(20),
    njsa_section_name text,
    hierarchy_level character varying(50),
    hierarchy_path text,
    source_index integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_id bigint,
    nycls_law_id character varying(10),
    nycls_law_name text,
    nycls_article character varying(20),
    nycls_article_name text,
    nycls_section character varying(20),
    nycls_section_name text,
    descendant_linked_regulation_count integer DEFAULT 0,
    descendant_enabling_authority_count integer DEFAULT 0,
    nyc_doc_type character varying(20),
    nyc_title character varying(10),
    nyc_chapter character varying(20),
    nyc_section character varying(30),
    nyc_section_name text,
    search_vector tsvector,
    url text,
    CONSTRAINT chk_statutes_jurisdiction CHECK (((jurisdiction)::text = ANY ((ARRAY['NY'::character varying, 'NJ'::character varying, 'NYC'::character varying])::text[])))
);


--
-- Name: statutes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statutes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: statutes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statutes_id_seq OWNED BY public.statutes.id;


--
-- Name: tournament_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_examples (
    id integer NOT NULL,
    pattern_id integer NOT NULL,
    jenai_issue_id integer,
    citation text NOT NULL,
    category text,
    severity integer,
    explanation text NOT NULL,
    fix text NOT NULL,
    why_it_matters text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    domain text DEFAULT ''::text
);


--
-- Name: tournament_examples_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_examples_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_examples_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_examples_id_seq OWNED BY public.tournament_examples.id;


--
-- Name: tournament_named_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_named_findings (
    id integer NOT NULL,
    name text NOT NULL,
    fix text NOT NULL,
    citations text[] DEFAULT '{}'::text[] NOT NULL,
    why text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    domain text DEFAULT ''::text
);


--
-- Name: tournament_named_findings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_named_findings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_named_findings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_named_findings_id_seq OWNED BY public.tournament_named_findings.id;


--
-- Name: tournament_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_patterns (
    id integer NOT NULL,
    pass text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    regulation_count integer NOT NULL,
    citations text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    domain_breakdown jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT tournament_patterns_pass_check CHECK ((pass = ANY (ARRAY['pass1'::text, 'pass2'::text])))
);


--
-- Name: tournament_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_patterns_id_seq OWNED BY public.tournament_patterns.id;


--
-- Name: agencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies ALTER COLUMN id SET DEFAULT nextval('public.agencies_id_seq'::regclass);


--
-- Name: agency_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_aliases ALTER COLUMN id SET DEFAULT nextval('public.agency_aliases_id_seq'::regclass);


--
-- Name: bookmark_markers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_markers ALTER COLUMN id SET DEFAULT nextval('public.bookmark_markers_id_seq'::regclass);


--
-- Name: bookmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks ALTER COLUMN id SET DEFAULT nextval('public.bookmarks_id_seq'::regclass);


--
-- Name: compliance_issue_analyses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses ALTER COLUMN id SET DEFAULT nextval('public.compliance_issue_analyses_id_seq'::regclass);


--
-- Name: compliance_issue_analysis_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analysis_reviews ALTER COLUMN id SET DEFAULT nextval('public.compliance_issue_analysis_reviews_id_seq'::regclass);


--
-- Name: compliance_issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issues ALTER COLUMN id SET DEFAULT nextval('public.compliance_issues_id_seq'::regclass);


--
-- Name: cross_references id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references ALTER COLUMN id SET DEFAULT nextval('public.cross_references_id_seq'::regclass);


--
-- Name: definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definitions ALTER COLUMN id SET DEFAULT nextval('public.definitions_id_seq'::regclass);


--
-- Name: document_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes ALTER COLUMN id SET DEFAULT nextval('public.document_notes_id_seq'::regclass);


--
-- Name: document_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags ALTER COLUMN id SET DEFAULT nextval('public.document_tags_id_seq'::regclass);


--
-- Name: domain_analyses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_analyses ALTER COLUMN id SET DEFAULT nextval('public.domain_analyses_id_seq'::regclass);


--
-- Name: eval_human_votes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes ALTER COLUMN id SET DEFAULT nextval('public.eval_human_votes_id_seq'::regclass);


--
-- Name: eval_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results ALTER COLUMN id SET DEFAULT nextval('public.eval_results_id_seq'::regclass);


--
-- Name: eval_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs ALTER COLUMN id SET DEFAULT nextval('public.eval_runs_id_seq'::regclass);


--
-- Name: fines_fees_penalties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines_fees_penalties ALTER COLUMN id SET DEFAULT nextval('public.fines_fees_penalties_id_seq'::regclass);


--
-- Name: guidance_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidance_documents ALTER COLUMN id SET DEFAULT nextval('public.guidance_documents_id_seq'::regclass);


--
-- Name: incorporations_by_reference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incorporations_by_reference ALTER COLUMN id SET DEFAULT nextval('public.incorporations_by_reference_id_seq'::regclass);


--
-- Name: jenai_analyses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_analyses ALTER COLUMN id SET DEFAULT nextval('public.jenai_analyses_id_seq'::regclass);


--
-- Name: jenai_issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues ALTER COLUMN id SET DEFAULT nextval('public.jenai_issues_id_seq'::regclass);


--
-- Name: marker_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marker_groups ALTER COLUMN id SET DEFAULT nextval('public.marker_groups_id_seq'::regclass);


--
-- Name: prompt_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_feedback ALTER COLUMN id SET DEFAULT nextval('public.prompt_feedback_id_seq'::regclass);


--
-- Name: prompt_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates ALTER COLUMN id SET DEFAULT nextval('public.prompt_templates_id_seq'::regclass);


--
-- Name: regulation_statute_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links ALTER COLUMN id SET DEFAULT nextval('public.regulation_statute_links_id_seq'::regclass);


--
-- Name: regulatory_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_documents ALTER COLUMN id SET DEFAULT nextval('public.regulatory_documents_id_seq'::regclass);


--
-- Name: share_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens ALTER COLUMN id SET DEFAULT nextval('public.share_tokens_id_seq'::regclass);


--
-- Name: statute_mandate_checks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks ALTER COLUMN id SET DEFAULT nextval('public.statute_mandate_checks_id_seq'::regclass);


--
-- Name: statute_references id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_references ALTER COLUMN id SET DEFAULT nextval('public.statute_references_id_seq'::regclass);


--
-- Name: statutes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutes ALTER COLUMN id SET DEFAULT nextval('public.statutes_id_seq'::regclass);


--
-- Name: tournament_examples id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_examples ALTER COLUMN id SET DEFAULT nextval('public.tournament_examples_id_seq'::regclass);


--
-- Name: tournament_named_findings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_named_findings ALTER COLUMN id SET DEFAULT nextval('public.tournament_named_findings_id_seq'::regclass);


--
-- Name: tournament_patterns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_patterns ALTER COLUMN id SET DEFAULT nextval('public.tournament_patterns_id_seq'::regclass);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: agency_aliases agency_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_aliases
    ADD CONSTRAINT agency_aliases_pkey PRIMARY KEY (id);


--
-- Name: bookmark_markers bookmark_markers_bookmark_id_marker_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_markers
    ADD CONSTRAINT bookmark_markers_bookmark_id_marker_group_id_key UNIQUE (bookmark_id, marker_group_id);


--
-- Name: bookmark_markers bookmark_markers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_markers
    ADD CONSTRAINT bookmark_markers_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: compliance_issue_analyses compliance_issue_analyses_document_id_issue_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_document_id_issue_type_key UNIQUE (document_id, issue_type);


--
-- Name: compliance_issue_analyses compliance_issue_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_pkey PRIMARY KEY (id);


--
-- Name: compliance_issue_analysis_reviews compliance_issue_analysis_reviews_analysis_id_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analysis_reviews
    ADD CONSTRAINT compliance_issue_analysis_reviews_analysis_id_tier_key UNIQUE (analysis_id, tier);


--
-- Name: compliance_issue_analysis_reviews compliance_issue_analysis_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analysis_reviews
    ADD CONSTRAINT compliance_issue_analysis_reviews_pkey PRIMARY KEY (id);


--
-- Name: compliance_issues compliance_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issues
    ADD CONSTRAINT compliance_issues_pkey PRIMARY KEY (id);


--
-- Name: cross_references cross_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_pkey PRIMARY KEY (id);


--
-- Name: cross_references cross_references_source_document_id_raw_text_offset_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_source_document_id_raw_text_offset_key UNIQUE (source_document_id, raw_text, start_offset);


--
-- Name: definition_document_occurrences definition_document_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definition_document_occurrences
    ADD CONSTRAINT definition_document_occurrences_pkey PRIMARY KEY (definition_id, document_id);


--
-- Name: definitions definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_pkey PRIMARY KEY (id);


--
-- Name: document_notes document_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes
    ADD CONSTRAINT document_notes_pkey PRIMARY KEY (id);


--
-- Name: document_tags document_tags_document_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_tag_key UNIQUE (document_id, tag);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (id);


--
-- Name: domain_analyses domain_analyses_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_analyses
    ADD CONSTRAINT domain_analyses_domain_key UNIQUE (domain);


--
-- Name: domain_analyses domain_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_analyses
    ADD CONSTRAINT domain_analyses_pkey PRIMARY KEY (id);


--
-- Name: eval_human_votes eval_human_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes
    ADD CONSTRAINT eval_human_votes_pkey PRIMARY KEY (id);


--
-- Name: eval_results eval_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_pkey PRIMARY KEY (id);


--
-- Name: eval_runs eval_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_pkey PRIMARY KEY (id);


--
-- Name: fines_fees_penalties fines_fees_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines_fees_penalties
    ADD CONSTRAINT fines_fees_penalties_pkey PRIMARY KEY (id);


--
-- Name: guidance_documents guidance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidance_documents
    ADD CONSTRAINT guidance_documents_pkey PRIMARY KEY (id);


--
-- Name: incorporations_by_reference incorporations_by_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incorporations_by_reference
    ADD CONSTRAINT incorporations_by_reference_pkey PRIMARY KEY (id);


--
-- Name: jenai_analyses jenai_analyses_document_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_analyses
    ADD CONSTRAINT jenai_analyses_document_unique UNIQUE (document_id);


--
-- Name: jenai_analyses jenai_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_analyses
    ADD CONSTRAINT jenai_analyses_pkey PRIMARY KEY (id);


--
-- Name: jenai_issues jenai_issues_analysis_category_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues
    ADD CONSTRAINT jenai_issues_analysis_category_unique UNIQUE (analysis_id, category);


--
-- Name: jenai_issues jenai_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues
    ADD CONSTRAINT jenai_issues_pkey PRIMARY KEY (id);


--
-- Name: llm_api_cache llm_api_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_api_cache
    ADD CONSTRAINT llm_api_cache_pkey PRIMARY KEY (id);


--
-- Name: llm_api_cache llm_api_cache_request_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_api_cache
    ADD CONSTRAINT llm_api_cache_request_hash_key UNIQUE (request_hash);


--
-- Name: marker_groups marker_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marker_groups
    ADD CONSTRAINT marker_groups_pkey PRIMARY KEY (id);


--
-- Name: prompt_feedback prompt_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_feedback
    ADD CONSTRAINT prompt_feedback_pkey PRIMARY KEY (id);


--
-- Name: prompt_templates prompt_templates_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT prompt_templates_content_hash_key UNIQUE (content_hash);


--
-- Name: prompt_templates prompt_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT prompt_templates_pkey PRIMARY KEY (id);


--
-- Name: regulation_statute_links regulation_statute_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links
    ADD CONSTRAINT regulation_statute_links_pkey PRIMARY KEY (id);


--
-- Name: regulation_statute_links regulation_statute_links_regulation_id_statute_id_citation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links
    ADD CONSTRAINT regulation_statute_links_regulation_id_statute_id_citation_key UNIQUE (regulation_id, statute_id, citation);


--
-- Name: regulatory_documents regulatory_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_documents
    ADD CONSTRAINT regulatory_documents_pkey PRIMARY KEY (id);


--
-- Name: share_tokens share_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_pkey PRIMARY KEY (id);


--
-- Name: share_tokens share_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_token_key UNIQUE (token);


--
-- Name: statute_mandate_checks statute_mandate_checks_analysis_id_statute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks
    ADD CONSTRAINT statute_mandate_checks_analysis_id_statute_id_key UNIQUE (analysis_id, statute_id);


--
-- Name: statute_mandate_checks statute_mandate_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks
    ADD CONSTRAINT statute_mandate_checks_pkey PRIMARY KEY (id);


--
-- Name: statute_references statute_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_references
    ADD CONSTRAINT statute_references_pkey PRIMARY KEY (id);


--
-- Name: statutes statutes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutes
    ADD CONSTRAINT statutes_pkey PRIMARY KEY (id);


--
-- Name: tournament_examples tournament_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_examples
    ADD CONSTRAINT tournament_examples_pkey PRIMARY KEY (id);


--
-- Name: tournament_named_findings tournament_named_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_named_findings
    ADD CONSTRAINT tournament_named_findings_pkey PRIMARY KEY (id);


--
-- Name: tournament_patterns tournament_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_patterns
    ADD CONSTRAINT tournament_patterns_pkey PRIMARY KEY (id);


--
-- Name: statutes unique_jurisdiction_citation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutes
    ADD CONSTRAINT unique_jurisdiction_citation UNIQUE (jurisdiction, citation);


--
-- Name: regulatory_documents unique_per_url; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_documents
    ADD CONSTRAINT unique_per_url UNIQUE (url);


--
-- Name: regulation_statute_links unique_regulation_statute_link; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links
    ADD CONSTRAINT unique_regulation_statute_link UNIQUE (regulation_id, citation);


--
-- Name: agencies uq_agencies_jurisdiction_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT uq_agencies_jurisdiction_name UNIQUE (jurisdiction, canonical_name);


--
-- Name: agency_aliases uq_agency_aliases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_aliases
    ADD CONSTRAINT uq_agency_aliases UNIQUE (agency_id, alias);


--
-- Name: idx_agencies_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agencies_jurisdiction ON public.agencies USING btree (jurisdiction);


--
-- Name: idx_agencies_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agencies_level ON public.agencies USING btree (level) WHERE (level IS NOT NULL);


--
-- Name: idx_agency_aliases_agency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agency_aliases_agency_id ON public.agency_aliases USING btree (agency_id);


--
-- Name: idx_agency_aliases_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agency_aliases_alias ON public.agency_aliases USING btree (alias);


--
-- Name: idx_analysis_reviews_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reviews_analysis ON public.compliance_issue_analysis_reviews USING btree (analysis_id);


--
-- Name: idx_analysis_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reviews_status ON public.compliance_issue_analysis_reviews USING btree (review_status);


--
-- Name: idx_analysis_reviews_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reviews_tier ON public.compliance_issue_analysis_reviews USING btree (tier) WHERE (tier IS NOT NULL);


--
-- Name: idx_bookmark_markers_bookmark; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmark_markers_bookmark ON public.bookmark_markers USING btree (bookmark_id);


--
-- Name: idx_bookmark_markers_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmark_markers_group ON public.bookmark_markers USING btree (marker_group_id);


--
-- Name: idx_bookmarks_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_analysis ON public.bookmarks USING btree (analysis_id);


--
-- Name: idx_bookmarks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_created_at ON public.bookmarks USING btree (created_at DESC);


--
-- Name: idx_bookmarks_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_document ON public.bookmarks USING btree (document_id);


--
-- Name: idx_bookmarks_fine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_fine ON public.bookmarks USING btree (fine_id);


--
-- Name: idx_bookmarks_guidance_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_guidance_document ON public.bookmarks USING btree (guidance_document_id);


--
-- Name: idx_bookmarks_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_jurisdiction ON public.bookmarks USING btree (jurisdiction);


--
-- Name: idx_bookmarks_unique_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bookmarks_unique_analysis ON public.bookmarks USING btree (analysis_id) WHERE (analysis_id IS NOT NULL);


--
-- Name: idx_bookmarks_unique_document; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bookmarks_unique_document ON public.bookmarks USING btree (document_id) WHERE (analysis_id IS NULL);


--
-- Name: idx_bookmarks_unique_fine; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bookmarks_unique_fine ON public.bookmarks USING btree (fine_id) WHERE (fine_id IS NOT NULL);


--
-- Name: idx_bookmarks_unique_guidance_document; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bookmarks_unique_guidance_document ON public.bookmarks USING btree (guidance_document_id) WHERE ((guidance_document_id IS NOT NULL) AND (analysis_id IS NULL));


--
-- Name: idx_cache_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_document ON public.llm_api_cache USING btree (document_id);


--
-- Name: idx_cache_request_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_request_hash ON public.llm_api_cache USING btree (request_hash);


--
-- Name: idx_cache_semantic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_semantic ON public.llm_api_cache USING btree (pipeline, tier);


--
-- Name: idx_cache_stale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_stale ON public.llm_api_cache USING btree (stale_after) WHERE (stale_after IS NOT NULL);


--
-- Name: idx_ci_guidance_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_guidance_document ON public.compliance_issues USING btree (guidance_document_id) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: idx_ci_unique_guidance; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ci_unique_guidance ON public.compliance_issues USING btree (guidance_document_id, issue_type, occurrence_number) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: idx_ci_unique_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ci_unique_reg ON public.compliance_issues USING btree (document_id, issue_type, occurrence_number) WHERE (document_id IS NOT NULL);


--
-- Name: idx_cia_active_by_jurisdiction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_active_by_jurisdiction_type ON public.compliance_issue_analyses USING btree (jurisdiction, issue_type, tier1_classification, tier2_classification, tier3_classification) WHERE (requirement_found = true);


--
-- Name: idx_cia_affected_population; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_affected_population ON public.compliance_issue_analyses USING btree (primary_affected_population) WHERE (primary_affected_population IS NOT NULL);


--
-- Name: idx_cia_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_agency ON public.compliance_issue_analyses USING btree (responsible_agency) WHERE (responsible_agency IS NOT NULL);


--
-- Name: idx_cia_burdensome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_burdensome ON public.compliance_issue_analyses USING btree (id) WHERE ((requirement_found = true) AND (is_justified = false));


--
-- Name: idx_cia_context_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_context_used ON public.compliance_issue_analyses USING gin (context_used);


--
-- Name: idx_cia_developer_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_developer_assigned ON public.compliance_issue_analyses USING btree (developer_assigned);


--
-- Name: idx_cia_developer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_developer_status ON public.compliance_issue_analyses USING btree (developer_status);


--
-- Name: idx_cia_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_document ON public.compliance_issue_analyses USING btree (document_id);


--
-- Name: idx_cia_guidance_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_guidance_document ON public.compliance_issue_analyses USING btree (guidance_document_id) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: idx_cia_high_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_high_severity ON public.compliance_issue_analyses USING btree (id) WHERE (final_severity >= 7);


--
-- Name: idx_cia_jurisdiction_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_jurisdiction_issue ON public.compliance_issue_analyses USING btree (jurisdiction, issue_type);


--
-- Name: idx_cia_jurisdiction_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_jurisdiction_severity ON public.compliance_issue_analyses USING btree (jurisdiction, final_severity) WHERE (final_severity IS NOT NULL);


--
-- Name: idx_cia_justified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_justified ON public.compliance_issue_analyses USING btree (id) WHERE (is_justified = true);


--
-- Name: idx_cia_needs_tier2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_needs_tier2 ON public.compliance_issue_analyses USING btree (id) WHERE (((tier1_classification)::text = 'needs_research'::text) AND (tier2_classification IS NULL));


--
-- Name: idx_cia_needs_tier3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_needs_tier3 ON public.compliance_issue_analyses USING btree (id) WHERE (((tier2_classification)::text = 'needs_full_context'::text) AND (tier3_classification IS NULL));


--
-- Name: idx_cia_pipeline_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_pipeline_version ON public.compliance_issue_analyses USING btree (pipeline_version);


--
-- Name: idx_cia_reform_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_reform_priority ON public.compliance_issue_analyses USING btree (reform_priority_score DESC) WHERE (reform_priority_score IS NOT NULL);


--
-- Name: idx_cia_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_review_status ON public.compliance_issue_analyses USING btree (review_status);


--
-- Name: idx_cia_review_summary_null; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_review_summary_null ON public.compliance_issue_analyses USING btree (jurisdiction, issue_type) WHERE (review_summary IS NULL);


--
-- Name: idx_cia_tier1_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_tier1_classification ON public.compliance_issue_analyses USING btree (tier1_classification);


--
-- Name: idx_cia_tier2_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_tier2_classification ON public.compliance_issue_analyses USING btree (tier2_classification);


--
-- Name: idx_cia_tier3_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cia_tier3_classification ON public.compliance_issue_analyses USING btree (tier3_classification);


--
-- Name: idx_cia_unique_guidance; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cia_unique_guidance ON public.compliance_issue_analyses USING btree (guidance_document_id, issue_type) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: idx_cia_unique_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cia_unique_reg ON public.compliance_issue_analyses USING btree (document_id, issue_type) WHERE (document_id IS NOT NULL);


--
-- Name: idx_compliance_issue_analyses_easy_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issue_analyses_easy_cleanup ON public.compliance_issue_analyses USING btree (easy_cleanup_candidate) WHERE (easy_cleanup_candidate = true);


--
-- Name: idx_compliance_issue_analyses_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issue_analyses_search_vector ON public.compliance_issue_analyses USING gin (search_vector);


--
-- Name: idx_compliance_issue_analyses_tier3_trigger_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issue_analyses_tier3_trigger_reason ON public.compliance_issue_analyses USING btree (tier3_trigger_reason) WHERE (tier3_trigger_reason IS NOT NULL);


--
-- Name: idx_compliance_issue_analyses_v5_tier3_triggers; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issue_analyses_v5_tier3_triggers ON public.compliance_issue_analyses USING btree (issue_type, cites_federal_statute, claims_no_alternative, severity) WHERE ((pipeline_version)::text = 'v5'::text);


--
-- Name: idx_compliance_issues_analysis_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_analysis_id ON public.compliance_issues USING btree (analysis_id);


--
-- Name: idx_compliance_issues_archive_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_archive_id ON public.compliance_issues_archive USING btree (id);


--
-- Name: idx_compliance_issues_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_document ON public.compliance_issues USING btree (document_id);


--
-- Name: idx_compliance_issues_issue_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_issue_type ON public.compliance_issues USING btree (issue_type);


--
-- Name: idx_compliance_issues_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_jurisdiction ON public.compliance_issues USING btree (jurisdiction);


--
-- Name: idx_compliance_issues_jurisdiction_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_jurisdiction_issue ON public.compliance_issues USING btree (jurisdiction, issue_type);


--
-- Name: idx_compliance_issues_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_issues_run_id ON public.compliance_issues USING btree (run_id);


--
-- Name: idx_cross_references_normalized_citation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cross_references_normalized_citation ON public.cross_references USING btree (normalized_citation);


--
-- Name: idx_crossrefs_cross_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_cross_jurisdiction ON public.cross_references USING btree (source_jurisdiction, target_jurisdiction) WHERE ((source_jurisdiction)::text <> (target_jurisdiction)::text);


--
-- Name: idx_crossrefs_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_jurisdiction ON public.cross_references USING btree (jurisdiction);


--
-- Name: idx_crossrefs_ref_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_ref_type ON public.cross_references USING btree (ref_type);


--
-- Name: idx_crossrefs_source_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_source_doc ON public.cross_references USING btree (source_document_id);


--
-- Name: idx_crossrefs_source_guidance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_source_guidance ON public.cross_references USING btree (source_guidance_id) WHERE (source_guidance_id IS NOT NULL);


--
-- Name: idx_crossrefs_source_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_source_jurisdiction ON public.cross_references USING btree (source_jurisdiction);


--
-- Name: idx_crossrefs_target_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_target_doc ON public.cross_references USING btree (target_document_id);


--
-- Name: idx_crossrefs_target_guidance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_target_guidance ON public.cross_references USING btree (target_guidance_id) WHERE (target_guidance_id IS NOT NULL);


--
-- Name: idx_crossrefs_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossrefs_unresolved ON public.cross_references USING btree (jurisdiction, is_resolved) WHERE (is_resolved = false);


--
-- Name: idx_def_doc_occurrences_definition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_def_doc_occurrences_definition ON public.definition_document_occurrences USING btree (definition_id);


--
-- Name: idx_def_doc_occurrences_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_def_doc_occurrences_document ON public.definition_document_occurrences USING btree (document_id);


--
-- Name: idx_definitions_developer_filters; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_developer_filters ON public.definitions USING btree (developer_status, developer_assigned);


--
-- Name: idx_definitions_developer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_developer_status ON public.definitions USING btree (developer_status);


--
-- Name: idx_definitions_normalized_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_normalized_term ON public.definitions USING btree (normalized_term);


--
-- Name: idx_definitions_normalized_term_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_normalized_term_trgm ON public.definitions USING gin (normalized_term public.gin_trgm_ops);


--
-- Name: idx_definitions_overlap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_overlap ON public.definitions USING btree (definition_overlap);


--
-- Name: idx_definitions_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_review_status ON public.definitions USING btree (review_status);


--
-- Name: idx_definitions_scope_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_scope_document ON public.definitions USING btree (scope_document_id);


--
-- Name: idx_definitions_scope_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_scope_level ON public.definitions USING btree (scope_level);


--
-- Name: idx_definitions_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_term ON public.definitions USING btree (term);


--
-- Name: idx_definitions_term_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_term_trgm ON public.definitions USING gin (term public.gin_trgm_ops);


--
-- Name: idx_definitions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_type ON public.definitions USING btree (definition_type);


--
-- Name: idx_definitions_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_definitions_url ON public.definitions USING btree (url);


--
-- Name: idx_document_notes_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_notes_document_id ON public.document_notes USING btree (document_id);


--
-- Name: idx_document_tags_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tags_document_id ON public.document_tags USING btree (document_id);


--
-- Name: idx_document_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tags_tag ON public.document_tags USING btree (tag);


--
-- Name: idx_documents_exclude_from_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_exclude_from_analysis ON public.regulatory_documents USING btree (exclude_from_analysis) WHERE (exclude_from_analysis = true);


--
-- Name: idx_documents_hierarchy_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_hierarchy_level ON public.regulatory_documents USING btree (hierarchy_level);


--
-- Name: idx_documents_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_jurisdiction ON public.regulatory_documents USING btree (jurisdiction);


--
-- Name: idx_documents_jurisdiction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_jurisdiction_type ON public.regulatory_documents USING btree (jurisdiction, type);


--
-- Name: idx_documents_nycrr_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_nycrr_part ON public.regulatory_documents USING btree (nycrr_part);


--
-- Name: idx_documents_nycrr_subpart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_nycrr_subpart ON public.regulatory_documents USING btree (nycrr_subpart);


--
-- Name: idx_documents_nycrr_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_nycrr_title ON public.regulatory_documents USING btree (nycrr_title);


--
-- Name: idx_documents_nycrr_title_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_nycrr_title_part ON public.regulatory_documents USING btree (nycrr_title, nycrr_part);


--
-- Name: idx_documents_nycrr_title_part_subpart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_nycrr_title_part_subpart ON public.regulatory_documents USING btree (nycrr_title, nycrr_part, nycrr_subpart);


--
-- Name: idx_documents_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_parent ON public.regulatory_documents USING btree (parent_id);


--
-- Name: idx_documents_regulatory_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_regulatory_status ON public.regulatory_documents USING btree (regulatory_status);


--
-- Name: idx_documents_regulatory_status_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_regulatory_status_jurisdiction ON public.regulatory_documents USING btree (jurisdiction, regulatory_status);


--
-- Name: idx_documents_short_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_short_title ON public.regulatory_documents USING btree (short_title);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.regulatory_documents USING btree (type);


--
-- Name: idx_documents_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_url ON public.regulatory_documents USING btree (url);


--
-- Name: idx_eval_human_votes_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_human_votes_doc ON public.eval_human_votes USING btree (document_id);


--
-- Name: idx_eval_results_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_doc ON public.eval_results USING btree (document_id, issue_type);


--
-- Name: idx_eval_results_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_run ON public.eval_results USING btree (eval_run_id);


--
-- Name: idx_fines_agency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_agency_id ON public.fines_fees_penalties USING btree (agency_id) WHERE (agency_id IS NOT NULL);


--
-- Name: idx_fines_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_document_id ON public.fines_fees_penalties USING btree (document_id) WHERE (document_id IS NOT NULL);


--
-- Name: idx_fines_guidance_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_guidance_document_id ON public.fines_fees_penalties USING btree (guidance_document_id) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: idx_fines_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_jurisdiction ON public.fines_fees_penalties USING btree (jurisdiction);


--
-- Name: idx_fines_llm_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_llm_confirmed ON public.fines_fees_penalties USING btree (llm_confirmed);


--
-- Name: idx_fines_penalty_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_penalty_type ON public.fines_fees_penalties USING btree (penalty_type);


--
-- Name: idx_fines_responsible_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_responsible_agency ON public.fines_fees_penalties USING btree (responsible_agency);


--
-- Name: idx_fines_who_pays_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fines_who_pays_normalized ON public.fines_fees_penalties USING btree (who_pays_normalized) WHERE (who_pays_normalized IS NOT NULL);


--
-- Name: idx_gd_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_agency ON public.guidance_documents USING btree (agency);


--
-- Name: idx_gd_canonical_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_canonical_ref ON public.guidance_documents USING btree (canonical_ref) WHERE (canonical_ref IS NOT NULL);


--
-- Name: idx_gd_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_gd_catalog_id ON public.guidance_documents USING btree (catalog_id) WHERE (catalog_id IS NOT NULL);


--
-- Name: idx_gd_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_doc_type ON public.guidance_documents USING btree (doc_type);


--
-- Name: idx_gd_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_jurisdiction ON public.guidance_documents USING btree (jurisdiction);


--
-- Name: idx_gd_policy_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_policy_category ON public.guidance_documents USING btree (policy_category) WHERE (policy_category IS NOT NULL);


--
-- Name: idx_gd_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_search ON public.guidance_documents USING gin (search_vector);


--
-- Name: idx_gd_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_status ON public.guidance_documents USING btree (status);


--
-- Name: idx_gd_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_year ON public.guidance_documents USING btree (year);


--
-- Name: idx_guidance_documents_target_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guidance_documents_target_audience ON public.guidance_documents USING gin (target_audience);


--
-- Name: idx_guidance_exclude_from_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guidance_exclude_from_analysis ON public.guidance_documents USING btree (exclude_from_analysis) WHERE (exclude_from_analysis = true);


--
-- Name: idx_ibr_developer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_developer_status ON public.incorporations_by_reference USING btree (developer_status);


--
-- Name: idx_ibr_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_document ON public.incorporations_by_reference USING btree (document_id);


--
-- Name: idx_ibr_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_jurisdiction ON public.incorporations_by_reference USING btree (jurisdiction);


--
-- Name: idx_ibr_llm_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_llm_confirmed ON public.incorporations_by_reference USING btree (llm_confirmed);


--
-- Name: idx_ibr_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_organization ON public.incorporations_by_reference USING btree (source_organization);


--
-- Name: idx_ibr_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ibr_review_status ON public.incorporations_by_reference USING btree (review_status);


--
-- Name: idx_jenai_analyses_adjusted_burden_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_analyses_adjusted_burden_desc ON public.jenai_analyses USING btree (adjusted_burden DESC NULLS LAST);


--
-- Name: idx_jenai_analyses_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_analyses_agency ON public.jenai_analyses USING btree (responsible_agency) WHERE (responsible_agency IS NOT NULL);


--
-- Name: idx_jenai_analyses_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_analyses_jurisdiction ON public.jenai_analyses USING btree (jurisdiction);


--
-- Name: idx_jenai_analyses_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_analyses_run_id ON public.jenai_analyses USING btree (run_id);


--
-- Name: idx_jenai_issues_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_category ON public.jenai_issues USING btree (category);


--
-- Name: idx_jenai_issues_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_document ON public.jenai_issues USING btree (document_id);


--
-- Name: idx_jenai_issues_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_review_status ON public.jenai_issues USING btree (review_status);


--
-- Name: idx_jenai_issues_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_search ON public.jenai_issues USING gin (public.jenai_issues_search_tsvector(explanation, tags));


--
-- Name: idx_jenai_issues_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_severity ON public.jenai_issues USING btree (severity);


--
-- Name: idx_jenai_issues_topics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jenai_issues_topics ON public.jenai_issues USING gin (topics);


--
-- Name: idx_marker_groups_name_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_marker_groups_name_jurisdiction ON public.marker_groups USING btree (lower((name)::text), COALESCE(jurisdiction, '__global__'::character varying));


--
-- Name: idx_prompt_feedback_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompt_feedback_created_at ON public.prompt_feedback USING btree (created_at DESC);


--
-- Name: idx_prompt_feedback_feedback_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompt_feedback_feedback_type ON public.prompt_feedback USING btree (feedback_type);


--
-- Name: idx_prompt_feedback_prompt_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompt_feedback_prompt_name ON public.prompt_feedback USING btree (prompt_name);


--
-- Name: idx_prompt_templates_pipeline_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompt_templates_pipeline_tier ON public.prompt_templates USING btree (pipeline, tier);


--
-- Name: idx_rd_applies_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_applies_to ON public.regulatory_documents USING gin (applies_to);


--
-- Name: idx_rd_has_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_has_form ON public.regulatory_documents USING btree (has_form) WHERE (has_form = true);


--
-- Name: idx_rd_has_ibr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_has_ibr ON public.regulatory_documents USING btree (has_ibr) WHERE (has_ibr = true);


--
-- Name: idx_rd_jurisdiction_section_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_jurisdiction_section_type ON public.regulatory_documents USING btree (jurisdiction, section_type) WHERE (section_type IS NOT NULL);


--
-- Name: idx_rd_jurisdiction_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rd_jurisdiction_source_type ON public.regulatory_documents USING btree (jurisdiction, source_index, type);


--
-- Name: idx_rd_keywords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_keywords ON public.regulatory_documents USING gin (keywords);


--
-- Name: idx_rd_rcny_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_rcny_title ON public.regulatory_documents USING btree (rcny_title) WHERE ((jurisdiction)::text = 'NYC'::text);


--
-- Name: idx_rd_section_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rd_section_type ON public.regulatory_documents USING btree (section_type) WHERE (section_type IS NOT NULL);


--
-- Name: idx_reg_statute_links_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_statute_links_reg ON public.regulation_statute_links USING btree (regulation_id);


--
-- Name: idx_reg_statute_links_statute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_statute_links_statute ON public.regulation_statute_links USING btree (statute_id);


--
-- Name: idx_regulatory_documents_citation_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulatory_documents_citation_trgm ON public.regulatory_documents USING gin (citation public.gin_trgm_ops);


--
-- Name: idx_regulatory_documents_content_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulatory_documents_content_trgm ON public.regulatory_documents USING gin (content public.gin_trgm_ops);


--
-- Name: idx_regulatory_documents_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulatory_documents_search_vector ON public.regulatory_documents USING gin (search_vector);


--
-- Name: idx_share_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_tokens_token ON public.share_tokens USING btree (token);


--
-- Name: idx_share_tokens_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_tokens_used ON public.share_tokens USING btree (used);


--
-- Name: idx_statute_mandate_checks_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statute_mandate_checks_analysis ON public.statute_mandate_checks USING btree (analysis_id);


--
-- Name: idx_statute_mandate_checks_mandated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statute_mandate_checks_mandated ON public.statute_mandate_checks USING btree (statute_mandated);


--
-- Name: idx_statute_references_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statute_references_document ON public.statute_references USING btree (document_id);


--
-- Name: idx_statutes_citation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_citation ON public.statutes USING btree (citation);


--
-- Name: idx_statutes_hierarchy_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_hierarchy_level ON public.statutes USING btree (hierarchy_level);


--
-- Name: idx_statutes_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_jurisdiction ON public.statutes USING btree (jurisdiction);


--
-- Name: idx_statutes_njsa_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_njsa_title ON public.statutes USING btree (njsa_title);


--
-- Name: idx_statutes_nyc_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_nyc_doc_type ON public.statutes USING btree (nyc_doc_type) WHERE (nyc_doc_type IS NOT NULL);


--
-- Name: idx_statutes_nyc_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_nyc_title ON public.statutes USING btree (nyc_title) WHERE (nyc_title IS NOT NULL);


--
-- Name: idx_statutes_nycls_law_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_nycls_law_id ON public.statutes USING btree (nycls_law_id);


--
-- Name: idx_statutes_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_parent_id ON public.statutes USING btree (parent_id);


--
-- Name: idx_statutes_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutes_search_vector ON public.statutes USING gin (search_vector);


--
-- Name: idx_tournament_examples_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_examples_pattern ON public.tournament_examples USING btree (pattern_id);


--
-- Name: idx_tournament_patterns_pass; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_patterns_pass ON public.tournament_patterns USING btree (pass);


--
-- Name: jenai_analyses_document_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jenai_analyses_document_id_unique ON public.jenai_analyses USING btree (document_id) WHERE (document_id IS NOT NULL);


--
-- Name: jenai_analyses_guidance_document_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jenai_analyses_guidance_document_id_unique ON public.jenai_analyses USING btree (guidance_document_id) WHERE (guidance_document_id IS NOT NULL);


--
-- Name: compliance_issue_analyses trg_compliance_issue_analyses_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_issue_analyses_search_vector BEFORE INSERT OR UPDATE OF tier2_reasoning, tier3_reasoning, verbatim_requirements ON public.compliance_issue_analyses FOR EACH ROW EXECUTE FUNCTION public.compliance_issue_analyses_search_vector_update();


--
-- Name: jenai_issues trg_jenai_issues_burden_recalc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_jenai_issues_burden_recalc AFTER INSERT OR DELETE OR UPDATE ON public.jenai_issues FOR EACH ROW EXECUTE FUNCTION public.recalculate_jenai_burden();


--
-- Name: regulatory_documents trg_regulatory_documents_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_regulatory_documents_search_vector BEFORE INSERT OR UPDATE OF title, summary, content ON public.regulatory_documents FOR EACH ROW EXECUTE FUNCTION public.regulatory_documents_search_vector_update();


--
-- Name: statutes trg_statutes_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_statutes_search_vector BEFORE INSERT OR UPDATE OF title, content ON public.statutes FOR EACH ROW EXECUTE FUNCTION public.statutes_search_vector_update();


--
-- Name: guidance_documents trig_gd_search; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_gd_search BEFORE INSERT OR UPDATE OF title, content ON public.guidance_documents FOR EACH ROW EXECUTE FUNCTION public.guidance_documents_search_trigger();


--
-- Name: agency_aliases agency_aliases_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_aliases
    ADD CONSTRAINT agency_aliases_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: bookmark_markers bookmark_markers_bookmark_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_markers
    ADD CONSTRAINT bookmark_markers_bookmark_id_fkey FOREIGN KEY (bookmark_id) REFERENCES public.bookmarks(id) ON DELETE CASCADE;


--
-- Name: bookmark_markers bookmark_markers_marker_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmark_markers
    ADD CONSTRAINT bookmark_markers_marker_group_id_fkey FOREIGN KEY (marker_group_id) REFERENCES public.marker_groups(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.compliance_issue_analyses(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_fine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_fine_id_fkey FOREIGN KEY (fine_id) REFERENCES public.fines_fees_penalties(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_issue_analyses compliance_issue_analyses_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_issue_analyses compliance_issue_analyses_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_issue_analyses compliance_issue_analyses_tier1_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_tier1_prompt_id_fkey FOREIGN KEY (tier1_prompt_id) REFERENCES public.prompt_templates(id);


--
-- Name: compliance_issue_analyses compliance_issue_analyses_tier2_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_tier2_prompt_id_fkey FOREIGN KEY (tier2_prompt_id) REFERENCES public.prompt_templates(id);


--
-- Name: compliance_issue_analyses compliance_issue_analyses_tier3_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analyses
    ADD CONSTRAINT compliance_issue_analyses_tier3_prompt_id_fkey FOREIGN KEY (tier3_prompt_id) REFERENCES public.prompt_templates(id);


--
-- Name: compliance_issue_analysis_reviews compliance_issue_analysis_reviews_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issue_analysis_reviews
    ADD CONSTRAINT compliance_issue_analysis_reviews_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.compliance_issue_analyses(id) ON DELETE CASCADE;


--
-- Name: compliance_issues compliance_issues_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issues
    ADD CONSTRAINT compliance_issues_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.compliance_issue_analyses(id) ON DELETE SET NULL;


--
-- Name: compliance_issues compliance_issues_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issues
    ADD CONSTRAINT compliance_issues_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_issues compliance_issues_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_issues
    ADD CONSTRAINT compliance_issues_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: cross_references cross_references_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: cross_references cross_references_source_guidance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_source_guidance_id_fkey FOREIGN KEY (source_guidance_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: cross_references cross_references_target_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_target_document_id_fkey FOREIGN KEY (target_document_id) REFERENCES public.regulatory_documents(id) ON DELETE SET NULL;


--
-- Name: cross_references cross_references_target_guidance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_references
    ADD CONSTRAINT cross_references_target_guidance_id_fkey FOREIGN KEY (target_guidance_id) REFERENCES public.guidance_documents(id) ON DELETE SET NULL;


--
-- Name: definition_document_occurrences definition_document_occurrences_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definition_document_occurrences
    ADD CONSTRAINT definition_document_occurrences_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.definitions(id) ON DELETE CASCADE;


--
-- Name: definition_document_occurrences definition_document_occurrences_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definition_document_occurrences
    ADD CONSTRAINT definition_document_occurrences_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: definitions definitions_scope_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.definitions
    ADD CONSTRAINT definitions_scope_document_id_fkey FOREIGN KEY (scope_document_id) REFERENCES public.regulatory_documents(id) ON DELETE SET NULL;


--
-- Name: document_notes document_notes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes
    ADD CONSTRAINT document_notes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: document_tags document_tags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: eval_human_votes eval_human_votes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes
    ADD CONSTRAINT eval_human_votes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: eval_human_votes eval_human_votes_eval_result_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes
    ADD CONSTRAINT eval_human_votes_eval_result_a_id_fkey FOREIGN KEY (eval_result_a_id) REFERENCES public.eval_results(id) ON DELETE CASCADE;


--
-- Name: eval_human_votes eval_human_votes_eval_result_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes
    ADD CONSTRAINT eval_human_votes_eval_result_b_id_fkey FOREIGN KEY (eval_result_b_id) REFERENCES public.eval_results(id) ON DELETE CASCADE;


--
-- Name: eval_results eval_results_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: eval_results eval_results_eval_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_eval_run_id_fkey FOREIGN KEY (eval_run_id) REFERENCES public.eval_runs(id) ON DELETE CASCADE;


--
-- Name: fines_fees_penalties fines_fees_penalties_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines_fees_penalties
    ADD CONSTRAINT fines_fees_penalties_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: fines_fees_penalties fines_fees_penalties_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines_fees_penalties
    ADD CONSTRAINT fines_fees_penalties_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: fines_fees_penalties fines_fees_penalties_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines_fees_penalties
    ADD CONSTRAINT fines_fees_penalties_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: incorporations_by_reference incorporations_by_reference_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incorporations_by_reference
    ADD CONSTRAINT incorporations_by_reference_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: jenai_analyses jenai_analyses_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_analyses
    ADD CONSTRAINT jenai_analyses_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: jenai_analyses jenai_analyses_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_analyses
    ADD CONSTRAINT jenai_analyses_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: jenai_issues jenai_issues_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues
    ADD CONSTRAINT jenai_issues_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.jenai_analyses(id) ON DELETE CASCADE;


--
-- Name: jenai_issues jenai_issues_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues
    ADD CONSTRAINT jenai_issues_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: jenai_issues jenai_issues_guidance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jenai_issues
    ADD CONSTRAINT jenai_issues_guidance_document_id_fkey FOREIGN KEY (guidance_document_id) REFERENCES public.guidance_documents(id) ON DELETE CASCADE;


--
-- Name: regulation_statute_links regulation_statute_links_regulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links
    ADD CONSTRAINT regulation_statute_links_regulation_id_fkey FOREIGN KEY (regulation_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: regulation_statute_links regulation_statute_links_statute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulation_statute_links
    ADD CONSTRAINT regulation_statute_links_statute_id_fkey FOREIGN KEY (statute_id) REFERENCES public.statutes(id) ON DELETE CASCADE;


--
-- Name: regulatory_documents regulatory_documents_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_documents
    ADD CONSTRAINT regulatory_documents_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.regulatory_documents(id) ON DELETE SET NULL;


--
-- Name: statute_mandate_checks statute_mandate_checks_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks
    ADD CONSTRAINT statute_mandate_checks_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.compliance_issue_analyses(id) ON DELETE CASCADE;


--
-- Name: statute_mandate_checks statute_mandate_checks_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks
    ADD CONSTRAINT statute_mandate_checks_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.regulation_statute_links(id) ON DELETE SET NULL;


--
-- Name: statute_mandate_checks statute_mandate_checks_statute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_mandate_checks
    ADD CONSTRAINT statute_mandate_checks_statute_id_fkey FOREIGN KEY (statute_id) REFERENCES public.statutes(id) ON DELETE CASCADE;


--
-- Name: statute_references statute_references_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statute_references
    ADD CONSTRAINT statute_references_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- Name: statutes statutes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutes
    ADD CONSTRAINT statutes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.statutes(id) ON DELETE SET NULL;


--
-- Name: tournament_examples tournament_examples_jenai_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_examples
    ADD CONSTRAINT tournament_examples_jenai_issue_id_fkey FOREIGN KEY (jenai_issue_id) REFERENCES public.jenai_issues(id);


--
-- Name: tournament_examples tournament_examples_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_examples
    ADD CONSTRAINT tournament_examples_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES public.tournament_patterns(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict uifdFwMvmj8Go4gSSEjogbPrqedmtqSXN3TEOCo1CHRDR1867mvXVhshphD2Wft

