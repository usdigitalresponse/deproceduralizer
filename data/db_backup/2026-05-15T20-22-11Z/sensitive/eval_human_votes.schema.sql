--
-- PostgreSQL database dump
--

\restrict YsDKN1O2Apb3wOWwisQmI6LPzWnPvDktMFhjt0b7i2qlC8r3S0jbdNiq8jALWJo

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
-- Name: eval_human_votes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes ALTER COLUMN id SET DEFAULT nextval('public.eval_human_votes_id_seq'::regclass);


--
-- Name: eval_human_votes eval_human_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_human_votes
    ADD CONSTRAINT eval_human_votes_pkey PRIMARY KEY (id);


--
-- Name: idx_eval_human_votes_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_human_votes_doc ON public.eval_human_votes USING btree (document_id);


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
-- PostgreSQL database dump complete
--

\unrestrict YsDKN1O2Apb3wOWwisQmI6LPzWnPvDktMFhjt0b7i2qlC8r3S0jbdNiq8jALWJo

