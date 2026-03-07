# tests/backend/test_rate_limiter.py
import time
import pytest
from unittest.mock import patch
from rate_limiter import RateLimiter

@pytest.fixture
def limiter():
    return RateLimiter()

class TestConnectionLimit:
    def test_allows_under_limit(self, limiter):
        for _ in range(9):
            assert limiter.check_connection("1.2.3.4") is True

    def test_blocks_at_limit(self, limiter):
        for _ in range(10):
            limiter.check_connection("1.2.3.4")
        assert limiter.check_connection("1.2.3.4") is False

    def test_different_ips_independent(self, limiter):
        for _ in range(10):
            limiter.check_connection("1.2.3.4")
        assert limiter.check_connection("5.6.7.8") is True

    def test_window_resets_after_60s(self, limiter):
        for _ in range(10):
            limiter.check_connection("1.2.3.4")
        # Simulate 61 seconds passing
        future = time.time() + 61
        with patch("time.time", return_value=future):
            assert limiter.check_connection("1.2.3.4") is True


class TestSessionStartLimit:
    def test_allows_under_limit(self, limiter):
        for _ in range(4):
            assert limiter.check_session_start("sid1") is True

    def test_blocks_at_limit(self, limiter):
        for _ in range(5):
            limiter.check_session_start("sid1")
        assert limiter.check_session_start("sid1") is False


class TestAudioChunkLimit:
    def test_allows_under_limit(self, limiter):
        for _ in range(199):
            assert limiter.check_audio_chunk("sid1") is True

    def test_blocks_at_limit(self, limiter):
        for _ in range(200):
            limiter.check_audio_chunk("sid1")
        assert limiter.check_audio_chunk("sid1") is False

    def test_clear_sid_resets_state(self, limiter):
        for _ in range(200):
            limiter.check_audio_chunk("sid1")
        limiter.clear_sid("sid1")
        assert limiter.check_audio_chunk("sid1") is True