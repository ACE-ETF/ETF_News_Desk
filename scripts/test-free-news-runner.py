import importlib.util
from datetime import datetime
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("runner", Path(__file__).with_name("free-news-runner.py"))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerSafetyTests(unittest.TestCase):
    def test_preserves_quantities_tickers_and_percent_signs(self):
        title = "SPY ETF attracts $2.5 billion, up 15%"
        self.assertTrue(runner.safe_translation(title, "SPY ETF에 2.5 billion 달러 유입, 15% 증가"))
        self.assertFalse(runner.safe_translation(title, "SPY ETF에 25 billion 달러 유입, 15% 증가"))
        self.assertFalse(runner.safe_translation(title, "SPY ETF에 2.5 billion 달러 유입, 15 감소"))
        self.assertFalse(runner.safe_translation(title, "QQQ ETF에 2.5 billion 달러 유입, 15% 증가"))

    def test_refuses_stale_window_or_early_publication(self):
        now = datetime(2026, 11, 17, 8, 0, tzinfo=runner.KST)
        today = {"window": {"start": "2026-11-15T22:40:00.000Z", "end": "2026-11-16T22:40:00.000Z"}}
        self.assertEqual(runner.check_window(today, now), today["window"])
        stale = {"window": {"start": "2026-11-12T22:40:00Z", "end": "2026-11-15T22:40:00Z"}}
        with self.assertRaises(runner.StopRun):
            runner.check_window(stale, now)
        self.assertTrue(runner.before_release(datetime(2026, 11, 17, 7, 39, tzinfo=runner.KST)))
        self.assertFalse(runner.before_release(datetime(2026, 11, 17, 7, 40, tzinfo=runner.KST)))

    def test_missing_key_never_starts_collection(self):
        with self.assertRaisesRegex(runner.StopRun, "SETUP_REQUIRED"):
            runner.require_key("")

    def test_zero_articles_never_publish(self):
        class API:
            def __init__(self):
                self.calls = []
            def request(self, path, body=None):
                self.calls.append((path, body))
                return {"window": {"start": "a", "end": "b"}, "articles": []}
        api = API()
        with patch.object(runner, "before_release", return_value=False), patch.object(
            runner, "check_window", return_value={"start": "a", "end": "b"}
        ):
            self.assertFalse(runner.release(api, "test-only", collect=False))
        self.assertEqual(len(api.calls), 1)

    def test_empty_translation_queue_does_not_load_model(self):
        with patch.object(runner, "translator", side_effect=AssertionError("model must not load")):
            self.assertEqual(runner.save_translations(None, []), (0, 0))

    def test_briefing_keeps_article_links_and_distinguishes_title_translation(self):
        article = {"id": "a", "title": "SPY ETF inflows rise", "category": "수급·성과",
                   "summaryKind": "title_translation", "summary": "SPY ETF 자금 유입 증가"}
        data = {"window": {"start": "s", "end": "e"}, "articles": [article],
                "brief": [], "overseasBrief": [article]}
        briefing = runner.make_briefing(data)
        self.assertEqual(briefing["items"][0]["articleIds"], ["a"])
        self.assertTrue(briefing["items"][0]["text"].startswith("제목 번역 기준:"))
        self.assertTrue(all(len(s) <= 160 for s in briefing["overview"]))


if __name__ == "__main__":
    unittest.main()
