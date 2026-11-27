"""Standalone public-data pipeline. No Site key, paid API, or local PC is required."""
from __future__ import annotations
import argparse
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[1]
BRANDS = ["ACE","TIGER","KODEX","RISE","SOL","PLUS","HANARO","KIWOOM","TIMEFOLIO","KoAct","1Q"]
DIRECT = [
    {"id":"yonhap-market","name":"연합뉴스","url":"https://www.yna.co.kr/rss/market.xml","gl":"KR","hosts":["www.yna.co.kr","yna.co.kr"]},
    {"id":"newsis-finance","name":"뉴시스","url":"https://www.newsis.com/RSS/bank.xml","gl":"KR","hosts":["www.newsis.com","newsis.com"]},
    {"id":"globenewswire-managers","name":"GlobeNewswire","url":"https://www.globenewswire.com/RssFeed/industry/8771-Asset%20Managers%2026%20Custodians/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Asset%20Managers%20and%20Custodians","gl":"US","hosts":["www.globenewswire.com","globenewswire.com"],"sourceType":"press_release"},
]
def log(**data):
    print(json.dumps(data, ensure_ascii=False), flush=True)
def iso(dt):
    return dt.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00","Z")
def stamp(value):
    return datetime.fromisoformat(value.replace("Z","+00:00"))
def read(path, default):
    return json.loads(path.read_text()) if path.exists() else default
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp=path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
    temp.replace(path)
def holidays():
    content=(ROOT/"lib"/"holidays.ts").read_text()
    return set(json.loads(re.search(r"new Set<string>\((\[.*?\])\)",content,re.S)[1]))
def business(day, closed):
    return day.weekday()<5 and day.isoformat() not in closed
def window(now, closed):
    end=now.astimezone(KST).replace(hour=7,minute=40,second=0,microsecond=0)
    if now<end: end-=timedelta(days=1)
    while not business(end.date(),closed):end-=timedelta(days=1)
    start=end-timedelta(days=1)
    while not business(start.date(),closed):start-=timedelta(days=1)
    return {"start":iso(start),"end":iso(end)}
def due(now, closed):
    local=now.astimezone(KST)
    return business(local.date(),closed) and (local.hour,local.minute)>=(7,40)
def category(title):
    policy_title=re.sub(r"비과세","",title) if re.search(r"분배|배당",title) else title
    if re.search(r"상장폐지|거래정지|규제|과세|세제|금융위|법안|세법|제도|개정|규정|\bSEC\b|regulat|liquidat|delist",policy_title,re.I):
        return "제도·시장"
    rules=[
        (r"특별\s*배당|특별\s*분배|분배금|분배율|분배락|배당락|(?:주당|좌당).*\d[\d,]*\s*원\s*분배|\d{1,2}월\s*\d[\d,]*\s*원\s*분배|distribution|dividend|payout","배당·분배"),
        (r"이벤트|경품|증정|캠페인|세미나|수상","마케팅"),
        (r"신규\s*상장|신규\s*출시|ETF.{0,20}출시|launch|debut","신규 상장"),
        (r"순매수|순매도|순자산|수익률|유입|유출|inflow|outflow|AUM|net assets|performance","수급·성과"),
    ]
    return next((label for pattern,label in rules if re.search(pattern,title,re.I)),"상품·전략")
def routine(a):
    return bool(re.search(r"option chain|stock price|price target|should you buy|FWP|매수해야 할|지금 사야",a["title"],re.I))
def rank(a):
    score={"제도·시장":50,"신규 상장":45,"수급·성과":40,"배당·분배":35,"상품·전략":25,"마케팅":10}.get(a["category"],0)
    if a["brands"]:score+=5
    if routine(a):score-=100
    return score
def external(url, size=2_000_000):
    req=urllib.request.Request(url,headers={"User-Agent":"ETFNewsDesk/2.0 (+https://ace-etf.github.io/ETF_News_Desk/)"})
    with urllib.request.urlopen(req,timeout=25) as r:
        raw=r.read(size+1)
        if len(raw)>size:raise ValueError("response_limit")
        return raw.decode("utf-8",errors="replace")
def parse_feed(xml, query, start, end):
    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():raise ValueError("unsupported_xml")
    root=ET.fromstring(xml)
    if root.tag.split("}")[-1] not in {"rss","feed"}:raise ValueError("invalid_feed")
    accepted=[];received=0;times=[]
    for item in root.iter():
        if item.tag.split("}")[-1] not in {"item","entry"}:continue
        received+=1
        tags={n.tag.split("}")[-1]:n for n in item}
        def text(name):
            return html.unescape("".join(tags[name].itertext()).strip()) if name in tags else ""
        title=re.sub(r"<[^>]+>","",text("title")).strip()
        url=text("link")
        if not url and "link" in tags:url=tags["link"].attrib.get("href","")
        source=text("source") or query.get("name","")
        if source and title.endswith(" - "+source):title=title[:-len(source)-3]
        raw_date=text("pubDate") or text("published") or text("updated")
        try:
            published=parsedate_to_datetime(raw_date) if not re.match(r"^\d{4}-",raw_date) else stamp(raw_date)
            if published.tzinfo is None:continue
        except (ValueError,TypeError,IndexError):continue
        times.append(published)
        host=urllib.parse.urlsplit(url).hostname
        if query["provider"]=="direct-rss" and host not in query["hosts"]:continue
        if query["provider"]=="google-rss" and host!="news.google.com":continue
        if not url.startswith("https://") or not re.search(r"ETFs?|exchange[ -]traded funds?|상장지수펀드",title,re.I):continue
        if not start<=published<end:continue
        brands=[b for b in BRANDS if re.search(r"(?<![A-Za-z0-9])"+re.escape(b)+r"(?![A-Za-z0-9])",title,re.I)]
        if re.search(r"한국투자(?:신탁)?운용",title) and "ACE" not in brands:brands.append("ACE")
        a={"id":hashlib.sha256(url.encode()).hexdigest(),"title":title,"url":url,"source":source or host,
           "published":iso(published),"date":published.astimezone(KST).date().isoformat(),
           "category":category(title),"brands":brands,"language":"en" if query["gl"]=="US" else "ko"}
        if query["gl"]=="US":a["marketHint"]="overseas"
        if query.get("sourceType"):a["sourceType"]=query["sourceType"]
        elif source in {"Business Wire","PR Newswire","GlobeNewswire"}:a["sourceType"]="press_release"
        accepted.append(a)
    return accepted,{"received":received,"accepted":len(accepted),
        "saturated":query["provider"]=="google-rss" and received>=100,
        "feedWindowLimited":query["provider"]=="direct-rss" and bool(times) and min(times)>start,
        "feedOldest":iso(min(times)) if times else None,"feedNewest":iso(max(times)) if times else None}
def new_state():
    return {"schemaVersion":2,"articles":{},"batches":[],"progress":{},"summaries":{}}
def claim(state, mode, now, closed):
    if mode=="stage":
        ident="static-stage-"+str(int(now.timestamp())//21600)
    else:
        ident="static-release-"+window(now,closed)["end"]
    old=next((b for b in state["batches"] if b["id"]==ident),None)
    if mode=="stored-release" or (mode!="stage" and not due(now,closed)):
        return {"id":ident,"fetchAllowed":False,"mode":mode}
    if old:
        return {"id":ident,"fetchAllowed":False,"mode":mode}
    end=now if mode=="stage" else stamp(window(now,closed)["end"])
    first=stamp(window(now,closed)["start"])
    queries=[dict(q,provider="direct-rss",feedId=q["id"],q=q["name"]+" ETF 직접 RSS") for q in DIRECT]
    for gl,q in [("KR","ETF -비트코인 -이더리움 -가상자산"),("US",'ETF (launch OR inflow OR outflow OR dividend OR bond OR equity OR fees) -bitcoin -ethereum -crypto')]:
        queries.append({"id":"google-"+gl,"gl":gl,"provider":"google-rss","q":q})
    for q in queries:
        prior=state["progress"].get(q["id"])
        start=stamp(prior)-timedelta(hours=1) if prior else min(first,end-timedelta(hours=7))
        q["recoveryTruncated"]=start<end-timedelta(hours=72)
        start=max(start,end-timedelta(hours=72))
        q["start"]=iso(start);q["end"]=iso(end)
        if q["provider"]=="google-rss":
            q["url"]="https://news.google.com/rss/search?"+urllib.parse.urlencode({
                "q":q["q"]+" after:"+(start-timedelta(days=1)).date().isoformat()+" before:"+(end+timedelta(days=1)).date().isoformat(),
                "hl":"ko" if q["gl"]=="KR" else "en-US","gl":q["gl"],"ceid":"KR:ko" if q["gl"]=="KR" else "US:en"})
    batch={"id":ident,"mode":"stage" if mode=="stage" else "release","started":iso(now),"start":min(q["start"] for q in queries),
           "end":iso(end),"queries":queries,"results":{},"fallbackCount":0,"coverageGap":any(q.get("recoveryTruncated") for q in queries)}
    state["batches"]=[batch]+state["batches"][:39]
    return {"id":ident,"fetchAllowed":True,"mode":mode}
def collect(state, context, state_path):
    if not context["fetchAllowed"]:
        log(collectionSkipped=True,reason="Existing or stored-only round; no RSS re-request.")
        return
    batch=next(b for b in state["batches"] if b["id"]==context["id"])
    blocked=set()
    for index,q in enumerate(batch["queries"]):
        provider=q["id"] if q["provider"]=="direct-rss" else "google-rss"
        if provider in blocked:
            batch["results"][str(index)]={"state":"failed","reason":"동일 공급자 오류로 남은 요청 중단"}
            continue
        if index:time.sleep(5)
        batch["results"][str(index)]={"state":"started"}
        write(state_path,state)
        try:
            xml=external(q["url"])
            articles,result=parse_feed(xml,q,stamp(q["start"]),stamp(q["end"]))
            for a in articles:state["articles"].setdefault(a["id"],a)
            state["progress"][q["id"]]=q["end"]
            batch["results"][str(index)]={"state":"success",**result}
            log(provider=q["id"],**result)
        except urllib.error.HTTPError as e:
            batch["results"][str(index)]={"state":"failed","reason":"HTTP "+str(e.code),"code":e.code}
            log(provider=q["id"],status=e.code)
            if e.code in [403,429,502,503]:blocked.add(provider)
        except Exception as e:
            batch["results"][str(index)]={"state":"failed","reason":type(e).__name__}
            log(provider=q["id"],error=type(e).__name__)
            blocked.add(provider)
        write(state_path,state)
    batch["finished"]=iso(datetime.now(UTC));write(state_path,state)
def protect_translate(text, translate):
    # Placeholders retain exact numbers, currencies and tickers through the local model.
    pattern=r"(?:[$€£¥₩]\s*)?\d[\d,.]*(?:\s*(?:billion|million|trillion|bn|mn))?%?|\b[A-Z][A-Z0-9.]{1,7}\b"
    protected=[]
    def shield(match):
        protected.append(match[0])
        return " ZXQ"+str(len(protected)-1)+"QXZ "
    masked=re.sub(pattern,shield,text)
    value=translate(masked)
    for index,token in enumerate(protected):
        marker="ZXQ"+str(index)+"QXZ"
        # If the model damages a marker, keep the English title instead of guessing.
        if value.count(marker)!=1:return None
        value=value.replace(marker,token)
    value=re.sub(r"\s+"," ",value).strip()
    if re.search(r"ZXQ|QXZ",value) or not re.search(r"[가-힣]",value):return None
    if len(value)>280 or len(value)<15:return None
    return value
def offline_translator():
    import ctranslate2
    import sentencepiece
    import zipfile
    cache=Path.home()/".cache"/"etf-news"/"en-ko"
    metadata=list(cache.glob("**/metadata.json")) if cache.exists() else []
    if not metadata:
        cache.mkdir(parents=True,exist_ok=True);archive=cache/"model.argosmodel"
        for model_url in [
            "https://data.argosopentech.com/argospm/v1/translate-en_ko-1_1.argosmodel",
            "https://argos-net.com/v1/translate-en_ko-1_1.argosmodel",
        ]:
            try:
                started=time.monotonic();total=0
                with urllib.request.urlopen(model_url,timeout=20) as response, archive.open("wb") as target:
                    while chunk:=response.read(1024*1024):
                        total+=len(chunk)
                        if total>250_000_000 or time.monotonic()-started>60:
                            raise TimeoutError("translation_model_download_limit")
                        target.write(chunk)
                break
            except (urllib.error.URLError,TimeoutError) as error:
                log(modelDownloadHost=urllib.parse.urlsplit(model_url).hostname,status=getattr(error,"code",None),error=type(error).__name__)
        else:raise RuntimeError("translation_model_download_unavailable")
        with zipfile.ZipFile(archive) as z:
            for member in z.infolist():
                if not (cache/member.filename).resolve().is_relative_to(cache.resolve()):raise ValueError("invalid_model_archive")
            z.extractall(cache)
        archive.unlink();metadata=list(cache.glob("**/metadata.json"))
    if not metadata:raise ValueError("model_metadata_missing")
    root=metadata[0].parent;meta=read(metadata[0],{})
    tokenizer=sentencepiece.SentencePieceProcessor(model_file=str(root/"sentencepiece.model"))
    model=ctranslate2.Translator(str(root/"model"),device="cpu",compute_type="int8",intra_threads=2,inter_threads=1)
    prefix=meta.get("target_prefix","")
    def translate(text):
        options={"beam_size":4,"replace_unknowns":True,"length_penalty":0.2}
        if prefix:options["target_prefix"]=[[prefix]]
        batch=model.translate_batch([tokenizer.encode(text,out_type=str)],**options)
        output=tokenizer.decode(batch[0].hypotheses[0]).strip()
        return output[len(prefix):].strip() if prefix and output.startswith(prefix) else output
    return translate
def translate_titles(state, articles):
    queue=[a for a in articles if a.get("language")=="en" and not routine(a) and not state["summaries"].get(a["id"])]
    if not queue:return
    try:
        translate=offline_translator();cache={}
        for a in queue:
            if a["title"] not in cache:
                try:
                    value=protect_translate(a["title"],translate)
                    if not value:
                        direct=translate(a["title"])
                        numeric=lambda s:Counter(re.findall(r"\d+(?:[.,]\d+)*%?",s))
                        tickers=set(re.findall(r"\b[A-Z][A-Z0-9.]{1,7}\b",a["title"]))
                        if (15<=len(direct)<=280 and re.search(r"[가-힣]",direct)
                            and numeric(direct)==numeric(a["title"])
                            and all(t in direct for t in tickers)):value=direct
                    cache[a["title"]]=value
                except Exception:cache[a["title"]]=None
            text=cache[a["title"]]
            if text:state["summaries"][a["id"]]={"text":text,"kind":"title_translation","sourceUrl":a["url"]}
        log(translationRequested=len(queue),translationSaved=sum(a["id"] in state["summaries"] for a in queue))
    except Exception as e:log(translationUnavailable=type(e).__name__,untranslated=len(queue))
def editorial(state, articles):
    for path in (ROOT/"editorial").glob("*.json"):
        for item in read(path,{}).get("items",[]):
            match=next((a for a in articles if a["id"]==item.get("id") and a["title"]==item.get("title")),None)
            if not match or item.get("kind") not in {"summary","title_translation"}:continue
            text=item.get("text","");source=item.get("sourceUrl",match["url"])
            if 15<=len(text)<=280 and source.startswith("https://"):
                state["summaries"][match["id"]]={"text":text,"kind":item["kind"],"sourceUrl":source}
def domestic_extracts(state, articles):
    existing=sum(1 for a in articles if a.get("language")=="ko" and state["summaries"].get(a["id"],{}).get("kind")=="summary")
    candidates=sorted([a for a in articles if a.get("language")=="ko" and not state["summaries"].get(a["id"]) and not routine(a)],key=rank,reverse=True)
    for a in candidates[:max(0,5-existing)]:
        # Do not resolve Google RSS through bypasses or paid providers.
        if urllib.parse.urlsplit(a["url"]).hostname=="news.google.com":continue
        try:
            import trafilatura
            time.sleep(5)
            content=trafilatura.extract(external(a["url"],1_000_000),include_comments=False,include_tables=False)
            paragraphs=[re.sub(r"\s+"," ",p).strip() for p in (content or "").splitlines()]
            for paragraph in paragraphs:
                sentence=re.split(r"(?<=[.!?])\s+",paragraph)[0]
                if re.search(r"ETF|상장지수펀드",sentence,re.I) and 50<=len(sentence)<=125 and len(sentence.split())<=23:
                    state["summaries"][a["id"]]={"text":"본문 발췌: "+sentence,"kind":"summary","sourceUrl":a["url"]}
                    break
        except Exception as e:log(bodyUnavailable=a["id"],error=type(e).__name__)
def enriched(state, a):
    summary=state["summaries"].get(a["id"])
    return dict(a,summary=summary["text"],summaryKind=summary["kind"],summarySource=summary["sourceUrl"]) if summary else a
def edition(state, selected, win, now):
    articles=sorted([enriched(state,a) for a in selected],key=lambda a:a["published"],reverse=True)
    usable=sorted([a for a in articles if not routine(a)],key=rank,reverse=True)
    domestic=[a for a in usable if a.get("language")=="ko"]
    overseas=[a for a in usable if a.get("language")=="en"]
    chosen=[];seen=[];categories=set()
    # Prefer verified summaries, separate news themes, and distinct events.
    candidates=sorted(domestic+overseas,key=lambda a:(a.get("summaryKind")=="summary",rank(a)),reverse=True)
    for diverse in (True,False):
        for a in candidates:
            key=re.sub(r"[\W_]+","",a["title"]).lower()
            numbers=tuple(re.findall(r"\d+(?:[.,]\d+)*",a["title"]))
            brands=frozenset(a["brands"])
            if any(numbers==digits and brands==names and SequenceMatcher(None,key,old).ratio()>=0.82
                   for old,digits,names in seen):continue
            if diverse and a["category"] in categories:continue
            seen.append((key,numbers,brands));categories.add(a["category"]);chosen.append(a)
            if len(chosen)==4:break
        if len(chosen)==4:break
    # Counts belong to collection status; the briefing describes actual news.
    overview=[(("제목 기준: " if a.get("summaryKind")!="summary" else "")+
               a.get("summary",a["title"]))[:160] for a in chosen[:2]]
    briefing={"windowStart":win["start"],"windowEnd":win["end"],"reviewed":False,"overview":overview,"items":[
        {"title":a["title"][:90],"text":(("제목 번역 기준: " if a.get("summaryKind")=="title_translation" else "")+a.get("summary","원제목 기준: "+a["title"]))[:400],"articleIds":[a["id"]]} for a in chosen]}
    ids={a["id"] for a in articles}
    for path in (ROOT/"editorial").glob("*.json"):
        reviewed=read(path,{}).get("briefing")
        if (reviewed and reviewed.get("windowStart")==win["start"] and reviewed.get("windowEnd")==win["end"]
            and 2<=len(reviewed.get("overview",[]))<=3
            and all(isinstance(t,str) and 0<len(t)<=160 for t in reviewed["overview"])
            and 1<=len(reviewed.get("items",[]))<=5
            and all(0<len(i.get("title",""))<=90 and 0<len(i.get("text",""))<=400
                    and 1<=len(i.get("articleIds",[]))<=3 and set(i["articleIds"]).issubset(ids) for i in reviewed["items"])):
            briefing=reviewed
    relevant=[b for b in state["batches"] if b["end"]>win["start"] and b["start"]<win["end"]]
    partial=not relevant or any(len(b["results"])<len(b["queries"]) or any(r["state"]!="success" for r in b["results"].values()) for b in relevant)
    missing=sum(a.get("language")=="en" and not a.get("summary") and not routine(a) for a in articles)
    return {"articles":articles,"dates":sorted({a["date"] for a in state["articles"].values()},reverse=True),"window":win,"briefing":briefing,
        "status":{"windowStart":win["start"],"windowEnd":win["end"],"updated":iso(now),"fetched":len(articles),"overseasFetched":len(overseas),
                  "errors":["일부 RSS 실패"] if partial else [],"partial":partial,"untranslated":missing,
                  "source":"언론사 직접 RSS · Google 뉴스 RSS","schedule":"6시간 수집 · 영업일 07:40 공개"}}
def publish(state, directory, now, closed):
    if not due(now,closed):
        log(published=False,reason="Before publication cutoff or Korean holiday.");return
    win=window(now,closed)
    selected=[a for a in state["articles"].values() if win["start"]<=a["published"]<win["end"]]
    if not selected:
        state["publicationError"]={"at":iso(now),"reason":"현재 공개 구간 기사 0건 · 기존 공개본 유지"}
        log(published=False,reason=state["publicationError"]["reason"]);return
    editorial(state,selected);domestic_extracts(state,selected);translate_titles(state,selected)
    public=edition(state,selected,win,now)
    write(directory/"public"/"latest.json",public)
    state.pop("publicationError",None)
    state["publicWindow"]=win
    log(published=True,window=win,count=len(selected),untranslated=public["status"]["untranslated"])
def export(state,directory,output):
    latest=read(directory/"public"/"latest.json",None)
    if latest is None:raise RuntimeError("No public edition; previous deployment retained.")
    days=sorted({a["date"] for a in state["articles"].values() if a["published"]<latest["window"]["end"]},reverse=True)
    latest["dates"]=days
    write(directory/"public"/"latest.json",latest)
    # Archives include published articles only, never the staging data after the cutoff.
    published_end=latest["window"]["end"]
    for day in days:
        start=datetime.fromisoformat(day+"T00:00:00+09:00");end=start+timedelta(days=1)
        articles=[enriched(state,a) for a in state["articles"].values() if a["date"]==day and a["published"]<published_end]
        if not articles:continue
        write(directory/"public"/"days"/(day+".json"),{"articles":articles,"dates":days,"status":latest["status"],
            "window":{"start":iso(start),"end":iso(end)},"briefing":None})
    pending=[a for a in state["articles"].values() if a["published"]>=published_end]
    health={"cadence":"매일 01:10·07:10·13:10·19:10 수집 · 한국 영업일 07:40 공개","pending":len(pending),
        "note":"RSS는 전체 기사의 전수 수집이 아닙니다. 직접 피드 제공 범위와 검색 RSS 100건 상한을 구분합니다.",
        "batches":state["batches"][:20],"rawArticles":sorted(state["articles"].values(),key=lambda a:a["published"],reverse=True)[:80],
        "publicationError":state.get("publicationError")}
    write(directory/"public"/"collection-status.json",health)
    if output.exists():shutil.rmtree(output)
    shutil.copytree(directory/"public",output)
    if latest["status"]["fetched"]!=len(latest["articles"]):raise RuntimeError("Public count mismatch.")
    log(exported=True,count=len(latest["articles"]),window=latest["window"])
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--mode",choices=["stage","release","stored-release"],default="release")
    parser.add_argument("--phase",choices=["claim","collect","publish","export"],required=True)
    parser.add_argument("--state-dir",default="_news_state")
    args=parser.parse_args()
    directory=Path(args.state_dir);state_path=directory/"state.json"
    state=read(state_path,new_state());now=datetime.now(UTC);closed=holidays()
    context_file=ROOT/"_news_context.json"
    if args.phase=="claim":
        context=claim(state,args.mode,now,closed);write(context_file,context);write(state_path,state)
        log(batch=context["id"],newRequestsAllowed=context["fetchAllowed"])
    elif args.phase=="collect":
        collect(state,read(context_file,{}),state_path)
    elif args.phase=="publish":
        if args.mode!="stage":publish(state,directory,now,closed)
        write(state_path,state)
    else:
        export(state,directory,ROOT/"public"/"news-data")
if __name__=="__main__":
    try:main()
    except Exception as e:
        log(error=type(e).__name__,message=str(e)[:160]);sys.exit(1)
