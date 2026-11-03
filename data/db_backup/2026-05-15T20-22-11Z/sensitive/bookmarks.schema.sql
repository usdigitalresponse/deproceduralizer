--
-- PostgreSQL database dump
--

\restrict 5bmvAbonQ1nABk5N0hdXd2dkuPanU8iaT3YREogCSzQOiOL6QhVPcDe7sPu4Z4g

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- Name: bookmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks ALTER COLUMN id SET DEFAULT nextval('public.bookmarks_id_seq'::regclass);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


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
-- PostgreSQL database dump complete
--

\unrestrict 5bmvAbonQ1nABk5N0hdXd2dkuPanU8iaT3YREogCSzQOiOL6QhVPcDe7sPu4Z4g

