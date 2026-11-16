import importlib.util
from datetime import datetime
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("pipeline",Path(__file__).with_name("static-news.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PipelineTests(unittest.TestCase):
    def test_business_window_weekend_and_cutoff(self):
        closed={"2026-11-16"}
        now=datetime(2026,11,17,8,tzinfo=m.KST)
        self.assertEqual(m.window(now,closed)["start"],"2026-11-12T22:40:00.000Z")
        self.assertEqual(m.window(now,closed)["end"],"2026-11-16T22:40:00.000Z")
        self.assertFalse(m.due(now.replace(hour=7,minute=39),closed))
        self.assertTrue(m.due(now.replace(hour=7,minute=40),closed))
        self.assertFalse(m.due(datetime(2026,11,15,8,tzinfo=m.KST),closed))
    def test_round_is_claimed_once_and_bounded(self):
        state=m.new_state();now=datetime(2026,11,17,8,tzinfo=m.KST)
        self.assertTrue(m.claim(state,"release",now,set())["fetchAllowed"])
        self.assertFalse(m.claim(state,"release",now,set())["fetchAllowed"])
        self.assertFalse(m.claim(state,"stored-release",now,set())["fetchAllowed"])
        self.assertEqual(len(state["batches"][0]["queries"]),5)
        q=state["batches"][0]["queries"][3]
        self.assertIn("hl=ko",q["url"])
    def test_korean_postpositions_and_feed_period(self):
        xml="<rss><channel><item><title>ACE ETF는 순자산 1조원 돌파</title><link>https://www.yna.co.kr/view/test</link><pubDate>Mon, 16 Nov 2026 09:00:00 +0900</pubDate></item></channel></rss>"
        q=dict(m.DIRECT[0],provider="direct-rss")
        lo=datetime(2026,11,16,7,40,tzinfo=m.KST);hi=lo+m.timedelta(days=1)
        rows,stats=m.parse_feed(xml,q,lo,hi)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]["brands"],["ACE"])
        rows,_=m.parse_feed(xml,q,hi,hi+m.timedelta(days=1));self.assertEqual(rows,[])
    def test_direct_feed_rejects_wrong_host_and_entities(self):
        q=dict(m.DIRECT[0],provider="direct-rss");now=datetime(2026,11,17,tzinfo=m.KST)
        xml="<rss><channel><item><title>ETF</title><link>https://example.com/a</link><pubDate>Mon, 16 Nov 2026 12:00:00 +0900</pubDate></item></channel></rss>"
        self.assertEqual(m.parse_feed(xml,q,now-m.timedelta(days=1),now)[0],[])
        with self.assertRaises(ValueError):m.parse_feed("<!DOCTYPE rss><rss/>",q,now,now)
    def test_zero_articles_keeps_existing_edition(self):
        with tempfile.TemporaryDirectory() as path:
            directory=Path(path);old={"existing":True}
            m.write(directory/"public"/"latest.json",old)
            state=m.new_state()
            m.publish(state,directory,datetime(2026,11,17,8,tzinfo=m.KST),set())
            self.assertEqual(m.read(directory/"public"/"latest.json",None),old)
            self.assertIn("publicationError",state)
    def test_staging_cannot_leak_into_archive(self):
        with tempfile.TemporaryDirectory() as path:
            directory=Path(path);state=m.new_state()
            for ident,when in [("old","2026-11-16T22:30:00.000Z"),("future","2026-11-16T23:30:00.000Z")]:
                state["articles"][ident]={"id":ident,"title":"ACE ETF 새 소식","date":"2026-11-17","published":when,"category":"상품·전략","language":"ko","brands":["ACE"],"url":"https://example.com/"+ident,"source":"test"}
            win={"start":"2026-11-15T22:40:00.000Z","end":"2026-11-16T22:40:00.000Z"}
            edition=m.edition(state,[state["articles"]["old"]],win,datetime.now(m.UTC))
            m.write(directory/"public"/"latest.json",edition)
            output=directory/"output";m.export(state,directory,output)
            saved=m.read(output/"days"/"2026-11-17.json",{})
            self.assertEqual([a["id"] for a in saved["articles"]],["old"])
    def test_damaged_translation_placeholders_are_not_saved(self):
        self.assertIsNone(m.protect_translate("SPY ETF inflows $2.5 billion",lambda s:"번역 결과에서 숫자를 잃었습니다"))
if __name__=="__main__":unittest.main()
