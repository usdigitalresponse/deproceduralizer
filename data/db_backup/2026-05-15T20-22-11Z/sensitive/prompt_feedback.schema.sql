--
-- PostgreSQL database dump
--

\restrict 1LMe4SlNxjxVxyFw5HZpetjPy4SjdZfS6LuCI8USbNVxZscYJd5ppqa1gllTOVh

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
-- Name: prompt_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_feedback ALTER COLUMN id SET DEFAULT nextval('public.prompt_feedback_id_seq'::regclass);


--
-- Name: prompt_feedback prompt_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_feedback
    ADD CONSTRAINT prompt_feedback_pkey PRIMARY KEY (id);


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
-- PostgreSQL database dump complete
--

\unrestrict 1LMe4SlNxjxVxyFw5HZpetjPy4SjdZfS6LuCI8USbNVxZscYJd5ppqa1gllTOVh

