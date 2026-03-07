# tests/backend/test_prompts.py
from prompts import build_system_prompt, build_rag_context

class TestBuildSystemPrompt:
    def test_contains_user_claim(self):
        prompt = build_system_prompt("my SaaS idea")
        assert "my SaaS idea" in prompt

    def test_claim_wrapped_in_tags(self):
        prompt = build_system_prompt("my SaaS idea")
        # Verify structural injection defense is in place
        assert "<user_claim>" in prompt
        assert "</user_claim>" in prompt

    def test_contains_core_instructions(self):
        prompt = build_system_prompt("anything")
        assert "CHALLENGE MODE" in prompt
        assert "QUESTION MODE" in prompt

class TestBuildRagContext:
    def test_contains_chunks(self):
        context = build_rag_context("some data point here")
        assert "some data point here" in context

    def test_contains_grounding_header(self):
        context = build_rag_context("data")
        assert "GROUNDING CONTEXT" in context