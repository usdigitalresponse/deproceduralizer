--
-- PostgreSQL database dump
--

\restrict jdX8P37SDPTbdDJOj64EppxmYiUQkRYEpDTfHDeh8KZGuuzBflBnlOab9dJxLK1

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
-- Name: share_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens ALTER COLUMN id SET DEFAULT nextval('public.share_tokens_id_seq'::regclass);


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
-- Name: idx_share_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_tokens_token ON public.share_tokens USING btree (token);


--
-- Name: idx_share_tokens_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_tokens_used ON public.share_tokens USING btree (used);


--
-- PostgreSQL database dump complete
--

\unrestrict jdX8P37SDPTbdDJOj64EppxmYiUQkRYEpDTfHDeh8KZGuuzBflBnlOab9dJxLK1

