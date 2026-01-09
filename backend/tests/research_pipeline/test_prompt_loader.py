"""Tests for prompt_loader module."""

import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class TestPromptLoaderUnit:
    """Test prompt/config loading - reads files, no DB."""

    def test_import(self):
        from scripts.research_pipeline.prompt_loader import (
            IssueConfig,
            TierConfig,
            load_issue_config,
            load_tier_config,
            load_all_tier_configs,
            get_all_issue_types,
        )

        assert IssueConfig is not None
        assert load_issue_config is not None

    def test_load_issue_config(self):
        from scripts.research_pipeline.prompt_loader import load_issue_config

        config = load_issue_config("mail_only")

        assert config.name == "mail_only"
        assert config.db_issue_type == "mail_only"
        assert config.display_name is not None
        assert config.severity_baseline >= 1
        assert config.severity_baseline <= 10

    def test_load_tier_config(self):
        from scripts.research_pipeline.prompt_loader import load_tier_config

        tier1 = load_tier_config("tier1")

        assert tier1.tier_name == "tier1"
        assert len(tier1.system) > 100  # Should have substantial content
        assert len(tier1.template) > 50
        assert tier1.updated_at is not None

    def test_load_all_tier_configs(self):
        from scripts.research_pipeline.prompt_loader import load_all_tier_configs

        tiers = load_all_tier_configs()

        # V5 uses 3-tier architecture (tier4 was consolidated into tier3)
        assert len(tiers) >= 3
        assert "tier1" in tiers
        assert "tier2" in tiers
        assert "tier3" in tiers

    def test_get_all_issue_types(self):
        from scripts.research_pipeline.prompt_loader import get_all_issue_types

        types = get_all_issue_types()

        assert len(types) >= 30  # We have 40+ issue types
        assert "mail_only" in types
        assert "wet_signature" in types
        assert "in_person_submission" in types

    def test_format_indicators(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            format_indicators_for_prompt,
        )

        config = load_issue_config("mail_only")
        positive, negative = format_indicators_for_prompt(config)

        # Should return strings (even if empty indicators)
        assert isinstance(positive, str)
        assert isinstance(negative, str)

    def test_format_severity(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            format_severity_for_prompt,
        )

        config = load_issue_config("mail_only")
        severity_str = format_severity_for_prompt(config)

        assert "Baseline severity" in severity_str
        assert str(config.severity_baseline) in severity_str

    def test_format_tier_prompt(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            load_tier_config,
            format_tier_prompt,
        )

        tier1 = load_tier_config("tier1")
        issue = load_issue_config("mail_only")

        formatted = format_tier_prompt(
            tier1,
            issue,
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            match_count=3,
            match_list="- Match 1\n- Match 2\n- Match 3",
        )

        assert "system" in formatted
        assert "user" in formatted
        assert "N.J.A.C. 1:1-1.1" in formatted["user"]
