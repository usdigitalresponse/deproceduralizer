-- Tournament results: mega-patterns and top examples from the JenAI tournament pipeline

CREATE TABLE tournament_patterns (
  id SERIAL PRIMARY KEY,
  pass TEXT NOT NULL CHECK (pass IN ('pass1', 'pass2')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  regulation_count INTEGER NOT NULL,
  citations TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournament_examples (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES tournament_patterns(id) ON DELETE CASCADE,
  jenai_issue_id INTEGER REFERENCES jenai_issues(id),
  citation TEXT NOT NULL,
  category TEXT,
  severity INTEGER,
  explanation TEXT NOT NULL,
  fix TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournament_named_findings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  fix TEXT NOT NULL,
  citations TEXT[] NOT NULL DEFAULT '{}',
  why TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournament_patterns_pass ON tournament_patterns(pass);
CREATE INDEX idx_tournament_examples_pattern ON tournament_examples(pattern_id);
