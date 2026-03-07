# tests/backend/test_report.py
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from session_state import SessionState

@pytest.fixture
def state():
    s = SessionState(user_claim="B2B SaaS for HR teams")
    s.add_turn("user", "We target mid-market companies")
    s.add_turn("agent", "What's your CAC payback period?")
    s.add_turn("user", "Under 12 months based on our pilots")
    return s

VALID_REPORT = {
    "idea_summary": "A B2B SaaS for HR",
    "overall_score": 7,
    "verdict": "Strong defense",
    "strengths": ["cited real data"],
    "weaknesses": ["market sizing unclear"],
    "sharpest_moment": "CAC payback answer",
    "biggest_gap": "distribution",
    "recommendation": "Nail down TAM"
}

VALID_JUDGE = {
    "scores": {
        "problem_clarity": 7,
        "market_logic": 6,
        "execution_risk": 5,
        "competitive_awareness": 6,
        "internal_coherence": 7
    },
    "overall": 6.2,
    "winner": "founder",
    "summary": "Solid performance overall"
}

class TestGenerateReport:
    async def test_returns_valid_report(self, state):
        mock_response = MagicMock()
        mock_response.text = json.dumps(VALID_REPORT)
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            from report import generate_report
            result = await generate_report(state)
        assert result["overall_score"] == 7
        assert len(result["strengths"]) >= 1

    async def test_sets_defaults_on_missing_fields(self, state):
        incomplete = {"overall_score": 5}
        mock_response = MagicMock()
        mock_response.text = json.dumps(incomplete)
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            from report import generate_report
            result = await generate_report(state)
        assert result["verdict"] == ""
        assert result["strengths"] == []

    async def test_returns_none_on_api_failure(self, state):
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(side_effect=Exception("API down"))
            from report import generate_report
            result = await generate_report(state)
        assert result is None


class TestRunJudge:
    async def test_returns_valid_judge_result(self, state):
        mock_response = MagicMock()
        mock_response.text = json.dumps(VALID_JUDGE)
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            from report import run_judge
            result = await run_judge(state)
        assert result["winner"] == "founder"
        assert result["overall"] == 6.2

    async def test_strips_markdown_fences(self, state):
        mock_response = MagicMock()
        mock_response.text = f"```json\n{json.dumps(VALID_JUDGE)}\n```"
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            from report import run_judge
            result = await run_judge(state)
        assert result is not None
        assert result["winner"] == "founder"

    async def test_returns_none_on_api_failure(self, state):
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(side_effect=Exception("API down"))
            from report import run_judge
            result = await run_judge(state)
        assert result is None

    async def test_computes_overall_if_missing(self, state):
        no_overall = dict(VALID_JUDGE)
        del no_overall["overall"]
        mock_response = MagicMock()
        mock_response.text = json.dumps(no_overall)
        with patch("report.client") as mock_client:
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            from report import run_judge
            result = await run_judge(state)
        assert result["overall"] == pytest.approx(6.2, 0.1)