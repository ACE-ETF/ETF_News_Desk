"""Free GitHub-hosted executor for the existing ETF News Desk.
Never prints or persists credentials. All writes target the existing Site only.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

SITE_URL = "https://etf-news-desk-insik.is-kim.chatgpt.site"
KST = ZoneInfo("Asia/Seoul")


class StopRun(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class SiteAPI:
    def __init__(self, key: str, origin: str = SITE_URL):
        if origin != SITE_URL:
            raise StopRun("Only the existing production Site is supported.")
        self.origin = origin
        self.key = key
        self.opener = urllib.request.build_opener(NoRedirect)

    def request(self, path: str, body=None):
        if not path.startswith("/api/") or "://" in path:
            raise StopRun("Invalid Site API path.")
        headers = {"Content-Type": "application/json", "Cache-Control": "no-cache"}
        if self.key:
            headers["X-Collector-Key"] = self.key
        raw = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        req = urllib.request.Request(self.origin + path, data=raw, headers=headers)
        try:
            with self.opener.open(req, timeout=50) as response:
                data = json.loads(response.read(8_000_000))
        except urllib.error.HTTPError as error:
            # Do not log request headers, response bodies, credentials, or redirects.
            raise StopRun("Site API HTTP " + str(error.code) + " at " + path.split("?")[0]) from None
        if isinstance(data, dict) and data.get("error"):
            raise StopRun("Site API rejected " + path.split("?")[0])
        return data


def announce(**fields):
    print(json.dumps(fields, ensure_ascii=False), flush=True)


def require_key(key):
    if not key:
        raise StopRun(
            "SETUP_REQUIRED: add repository Actions secret SITE_COLLECTOR_KEY "
            "with the existing Site COLLECTOR_KEY. No collection or publication was attempted."
        )


def run_collector(mode, key):
    collector = Path(__file__).resolve().parents[1] / "public" / "collector.py"
    result = subprocess.run(
        [sys.executable, str(collector)],
        input=json.dumps({"url": SITE_URL, "token": key, "mode": mode}) + "\n",
        text=True,
        check=False,
        timeout=900,
    )
    if result.returncode:
        raise StopRun("Bounded collector failed; no automatic retry.")


def before_release(now=None):
    now = now or datetime.now(KST)
    return (now.hour, now.minute) < (7, 40)


def check_window(data, now=None):
    now = now or datetime.now(KST)
    window = data.get("window", {})
    try:
        start = datetime.fromisoformat(window["start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(window["end"].replace("Z", "+00:00"))
    except (KeyError, TypeError, ValueError):
        raise StopRun("Missing publication window.") from None
    if not start < end or end > now or end.astimezone(KST).date() != now.date():
        raise StopRun("Refusing a future or stale publication window.")
    if end.astimezone(KST).strftime("%H:%M") != "07:40":
        raise StopRun("Publication boundary must remain 07:40 KST.")
    return window


def numbers(text):
    # Require exact quantities to survive offline translation.
    return Counter(re.findall(r"\d+(?:[.,]\d+)*%?", text))


def protected_terms(text):
    return set(re.findall(r"(?<![A-Za-z0-9])[A-Z][A-Z0-9.]{1,7}(?![A-Za-z0-9])", text))


def safe_translation(title, translated):
    return (
        15 <= len(translated) <= 280
        and bool(re.search(r"[가-힣]", translated))
        and numbers(title) == numbers(translated)
        and protected_terms(title).issubset(protected_terms(translated))
    )


def translator():
    # Optional, free offline model. No paid API or translation service receives articles.
    import argostranslate.package
    import argostranslate.translate
    installed = argostranslate.package.get_installed_packages()
    if not any(p.from_code == "en" and p.to_code == "ko" for p in installed):
        argostranslate.package.update_package_index()
        candidates = [
            p for p in argostranslate.package.get_available_packages()
            if p.from_code == "en" and p.to_code == "ko"
        ]
        if not candidates:
            raise StopRun("Offline English-to-Korean translation model is unavailable.")
        argostranslate.package.install_from_path(candidates[0].download())
    return lambda text: argostranslate.translate.translate(text, "en", "ko")


def save_translations(api, queue):
    if not queue:
        return 0, 0
    try:
        translate = translator()
    except Exception:
        announce(translationModelUnavailable=True, untranslated=len(queue))
        return 0, len(queue)
    cache, pending = {}, []
    saved, rejected = 0, 0
    for article in queue:
        title = article["title"]
        if title not in cache:
            try:
                cache[title] = translate(title).strip()
            except Exception:
                cache[title] = ""
        translated = cache[title]
        if not safe_translation(title, translated):
            rejected += 1
            continue
        pending.append({
            "id": article["id"], "date": article["date"],
            "sourceUrl": article["url"], "text": translated, "kind": "title_translation",
        })
        if len(pending) == 10:
            api.request("/api/summaries", {"items": pending})
            saved += len(pending)
            pending = []
    if pending:
        api.request("/api/summaries", {"items": pending})
        saved += len(pending)
    return saved, rejected


def extract_summary(article):
    # An explicitly labelled short extract, never presented as a model-written analysis.
    import trafilatura
    url = article["url"]
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    # Google RSS redirects usually do not expose the original body. Keep title-based text.
    if parsed.hostname in {"news.google.com", "consent.google.com"}:
        return None
    request = urllib.request.Request(url, headers={"User-Agent": "ETF-News-Desk/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            return None
        html = response.read(1_000_000).decode("utf-8", errors="replace")
    text = trafilatura.extract(html, include_comments=False, include_tables=False)
    if not text:
        return None
    paragraphs = [
        re.sub(r"\s+", " ", p).strip()
        for p in text.splitlines()
        if len(p.strip()) >= 35 and re.search(r"ETF|상장지수펀드", p, re.I)
    ]
    for paragraph in paragraphs:
        # Only keep complete sentences; no invented connective phrases or implications.
        sentence = re.split(r"(?<=[.!?])\s+", paragraph)[0].strip()
        if 50 <= len(sentence) <= 125 and len(sentence.split()) <= 23:
            return "본문 발췌: " + sentence
    return None


def save_domestic_summaries(api, data):
    existing = sum(
        1 for a in data.get("articles", [])
        if a.get("summaryKind") == "summary" and a.get("language") != "en"
    )
    allowance = max(0, 5 - existing)
    saved = 0
    candidates = [a for a in data.get("brief", []) if not a.get("summary")]
    for article in candidates[:allowance]:
        time.sleep(5)
        try:
            text = extract_summary(article)
        except Exception:
            text = None
        if not text:
            continue
        api.request("/api/summaries", {"items": [{
            "id": article["id"], "date": article["date"], "sourceUrl": article["url"],
            "text": text, "kind": "summary",
        }]})
        saved += 1
    return saved


def make_briefing(data):
    # Use server-ranked representative stories and verified text only.
    articles = data.get("articles", [])
    domestic = data.get("brief", [])
    overseas = data.get("overseasBrief", [])
    category_counts = Counter(a.get("category", "기타") for a in domestic)
    categories = "·".join(k for k, _ in category_counts.most_common(2)) or "ETF 관련 보도"
    overview = [
        "이번 공개 구간에는 기사 " + str(len(articles)) + "건이 저장됐으며, 국내 핵심 보도는 " + categories + " 중심입니다.",
        "아래 항목은 서버가 중복을 압축해 선정한 대표 보도의 원제목·저장 문구를 기준으로 정리했습니다.",
    ]
    chosen = domestic[:3] + overseas[:max(0, 4 - min(3, len(domestic)))]
    if not chosen:
        chosen = articles[:4]
    items = []
    for article in chosen[:4]:
        content = article.get("summary")
        if content:
            prefix = "제목 번역 기준: " if article.get("summaryKind") == "title_translation" else ""
            content = prefix + content
        else:
            content = "원제목 기준: " + article["title"]
        items.append({
            "title": (article.get("category", "ETF") + " · " + article["title"])[:90],
            "text": content[:400], "articleIds": [article["id"]],
        })
    return {
        "windowStart": data["window"]["start"], "windowEnd": data["window"]["end"],
        "overview": overview, "items": items,
    }


def release(api, key, collect=True):
    if before_release():
        raise StopRun("Release cannot start before 07:40 KST.")
    if collect:
        run_collector("release", key)
    data = api.request("/api/news?staged=1&brief=1")
    window = check_window(data)
    # Server returns the last business-day window on holidays; the freshness guard rejects it.
    if not data.get("articles"):
        announce(published=False, reason="Current window has no stored articles; existing public edition retained.")
        return False
    domestic_saved = save_domestic_summaries(api, data)
    queue = api.request("/api/news?staged=1&translations=1").get("translationQueue", [])
    translated, rejected = save_translations(api, queue)
    remaining = len(api.request("/api/news?staged=1&translations=1").get("translationQueue", []))
    data = api.request("/api/news?staged=1&brief=1")
    check_window(data)
    if data["window"] != window:
        raise StopRun("Publication window changed during preparation.")
    if not data.get("briefing"):
        api.request("/api/briefing?staged=1", make_briefing(data))
    result = api.request("/api/pipeline", {"action": "publish"})
    public = api.request("/api/news?brief=1")
    if public.get("window") != window or not public.get("articles"):
        raise StopRun("Public edition verification failed.")
    # Do not claim a successful refresh based solely on an old matching window.
    if result.get("published") is not True:
        raise StopRun("Server did not confirm publication.")
    announce(
        published=True, window=window, count=len(public["articles"]),
        domesticSummariesSaved=domestic_saved, titlesTranslated=translated,
        untranslated=remaining, rejectedTranslations=rejected,
        briefingPresent=bool(public.get("briefing")), url="https://ace-etf.github.io/ETF_News_Desk/",
    )
    if remaining:
        announce(partial=True, reason="Offline translation safety checks left titles untranslated.")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["stage", "release", "stored-release", "status"], required=True)
    args = parser.parse_args()
    key = os.environ.get("SITE_COLLECTOR_KEY", "")
    api = SiteAPI(key)
    if args.mode == "status":
        data = api.request("/api/news?brief=1")
        announce(window=data.get("window"), count=len(data.get("articles", [])),
                 status=data.get("status"), keyConfigured=bool(key))
        return
    require_key(key)
    if args.mode == "stage":
        run_collector("stage", key)
        status = api.request("/api/collection-status")
        announce(collectionStatus=status)
    else:
        release(api, key, collect=args.mode == "release")


if __name__ == "__main__":
    try:
        main()
    except StopRun as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # No exception text: third-party errors may contain network request details.
        print("Run failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
