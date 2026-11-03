--
-- PostgreSQL database dump
--

\restrict qLA7hEgfFeePDM9TXWp2AwjO06SQOI00b1IksYhkKvnetObyw6cOL3tsVhQhzQ5

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
-- Name: document_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes ALTER COLUMN id SET DEFAULT nextval('public.document_notes_id_seq'::regclass);


--
-- Name: document_notes document_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes
    ADD CONSTRAINT document_notes_pkey PRIMARY KEY (id);


--
-- Name: idx_document_notes_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_notes_document_id ON public.document_notes USING btree (document_id);


--
-- Name: document_notes document_notes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_notes
    ADD CONSTRAINT document_notes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.regulatory_documents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict qLA7hEgfFeePDM9TXWp2AwjO06SQOI00b1IksYhkKvnetObyw6cOL3tsVhQhzQ5

