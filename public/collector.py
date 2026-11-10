"""ETF Desk bounded scheduled collector. Credentials are read from hidden stdin only."""
import sys,json,urllib.request,urllib.error,urllib.parse,time,datetime,re,html,termios,hashlib
from html.parser import HTMLParser
if sys.stdin.isatty():
 attrs=termios.tcgetattr(sys.stdin);attrs[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,attrs)
print('Ready for collector JSON on hidden stdin',flush=True)
config=json.loads(sys.stdin.readline());origin=config['url'].rstrip('/');token=config['token'];mode=config.get('mode','stage')
headers={'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+token,'X-Collector-Key':token}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
site=urllib.request.build_opener(NoRedirect)
def api(action,**data):
 request=urllib.request.Request(origin+'/api/pipeline',data=json.dumps({'action':action,**data}).encode(),headers=headers)
 with site.open(request,timeout=45) as r:return json.load(r)
def external(url,maxbytes=2000000):
 # No Site credentials are ever forwarded to a news provider.
 with urllib.request.urlopen(url,timeout=22) as r:return r.read(maxbytes).decode('utf-8',errors='replace')
def log(**data):print(json.dumps(data,ensure_ascii=False),flush=True)
def http_diagnostics(error):
 # Only response fingerprints and explicitly allowed headers; no raw error body,
 # cookies, request headers, credentials or URL query strings are stored.
 raw=error.read(4096) if getattr(error,'fp',None) is not None else b''
 snippet=raw.decode('utf-8',errors='replace').lower()
 kind='captcha' if 'captcha' in snippet else 'proxy' if 'proxy' in snippet else 'cloudflare' if 'cloudflare' in snippet else 'google' if 'google' in snippet else 'unknown'
 d={'bodySha256':hashlib.sha256(raw).hexdigest(),'bodyClass':kind}
 for k in ['server','via','retry-after','content-type']:
  if error.headers and error.headers.get(k):d[k]=re.sub(r'[\r\n\x00-\x1f]',' ',error.headers.get(k))[:160]
 return d
class Links(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs);u=html.unescape(a.get('href',''))
  if t=='a' and re.match(r'https://n.news.naver.com/mnews/article/\d{3}/\d+',u):self.urls.append(u.split('?')[0])
class Meta(HTMLParser):
 def __init__(self):super().__init__();self.meta={};self.stamps=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='meta':self.meta[a.get('property') or a.get('name')]=a.get('content')
  if a.get('data-date-time'):self.stamps.append(a['data-date-time'])
def fallback(batch):
 reservation=api('reserveFallback',batchId=batch['id'])
 if not reservation.get('reserved'):return 0
 lo=datetime.datetime.fromisoformat(batch['start']);hi=datetime.datetime.fromisoformat(batch['end']);kst=datetime.timezone(datetime.timedelta(hours=9));urls=[];items=[];code=0;blocked=False;stats={"searchMatches":0,"articleChecked":0,"metadataRejected":0}
 queries=['ETF -비트코인 -이더리움 -가상자산 -암호화폐','미국 ETF'] if mode=='stage' else ['ETF -비트코인 -이더리움 -가상자산 -암호화폐','ACE ETF','상장지수펀드']
 limit=min(reservation['maxItems'],20 if mode=='stage' else 30)
 for q in queries:
  time.sleep(5)
  params={'where':'news','query':q,'sort':'1','pd':'3','ds':lo.astimezone(kst).strftime('%Y.%m.%d'),'de':hi.astimezone(kst).strftime('%Y.%m.%d')}
  try:
   s=external('https://search.naver.com/search.naver?'+urllib.parse.urlencode(params));p=Links();p.feed(s)
   # Keep room for both the domestic and US-listed ETF search results.
   urls+=list(dict.fromkeys(p.urls))[:10];stats['searchMatches']+=len(p.urls)
  except urllib.error.HTTPError as e:
   log(fallbackSearchStatus=e.code);code=e.code
   if e.code in [403,429,502,503]:blocked=True;break
  except Exception as e:
   log(fallbackSearchError=type(e).__name__);code=-1;blocked=True;break
 if not blocked and not urls:code=-2;log(fallbackNoExtractableLinks=True)
 if not blocked:
  for url in list(dict.fromkeys(urls))[:limit]:
   time.sleep(5);stats['articleChecked']+=1
   try:
    s=external(url,700000);p=Meta();p.feed(s);title=p.meta.get('og:title') or '';source=(p.meta.get('og:article:author') or '').split(' | ')[0]
    stamp=p.stamps[0] if p.stamps else None
    if not stamp or not source or not re.search(r'ETF|상장지수펀드',title,re.I):stats['metadataRejected']+=1;continue
    published=datetime.datetime.fromisoformat(stamp)
    if published.tzinfo is None:published=published.replace(tzinfo=kst)
    if not lo<=published<hi:continue
    items.append({'title':title,'url':url,'source':source,'published':published.isoformat()})
   except urllib.error.HTTPError as e:
    log(fallbackArticleStatus=e.code);code=e.code
    if e.code in [403,429,502,503]:break
   except Exception as e:
    log(fallbackArticleError=type(e).__name__);code=-1;break
 saved=0
 for i in range(0,len(items),10):
  if i:time.sleep(5)
  n=api('fallback',batchId=batch['id'],items=items[i:i+10]).get('saved',0);saved+=n;log(fallbackSaved=n)
 api('finishFallback',batchId=batch['id'],code=code,stats=stats);log(fallbackStats=stats)
 return saved

try:
 started=api('start',mode=mode)
 if started.get('skipped'):
  log(skipped=True,reason=started.get('reason'));sys.exit(0)
 batch=started['batch'];accepted=0;failed=False;blocked_providers=set()
 for i,query in enumerate(batch['queries']):
  provider=query.get('provider','google-rss')
  if provider in blocked_providers:continue
  if i:time.sleep(5)
  reservation=api('reserve',batchId=batch['id'],index=i)
  if reservation.get('skipped'):continue
  if provider=='naver-api':
   result=api('naverFeed',batchId=batch['id'],index=i);accepted+=result.get('saved',0);log(feed=i,provider=provider,**result)
   if result.get('failed'):
    failed=True;blocked_providers.add(provider)
   continue
  try:
   # A one-time recovery may ingest already-fetched RSS without re-requesting Google.
   if i==0 and config.get('cachedRss'):
    with open(config['cachedRss']) as f:xml=f.read(2000001)
   else:xml=external('https://news.google.com/rss/search?'+urllib.parse.urlencode({k:query[k] for k in ('q','hl','gl','ceid')}))
  except urllib.error.HTTPError as e:
   diagnostics=http_diagnostics(e);api('failure',batchId=batch['id'],index=i,code=e.code,diagnostics=diagnostics);log(feed=i,httpStatus=e.code,diagnostics=diagnostics);failed=True
   if e.code in [403,429,502,503]:blocked_providers.add(provider)
   continue
  except Exception as e:
   api('failure',batchId=batch['id'],index=i,code=0,diagnostics={'errorType':type(e).__name__});log(feed=i,error=type(e).__name__);failed=True;blocked_providers.add(provider);continue
  try:
   result=api('feed',batchId=batch['id'],index=i,xml=xml);accepted+=result['saved'];log(feed=i,**result)
  except urllib.error.HTTPError as e:
   if e.code in [401,403]:raise
   api('failure',batchId=batch['id'],index=i,code=0);log(feed=i,invalidRssOrSaveFailure=e.code);failed=True;break
 if (failed or accepted==0) and not any(q.get('provider')=='naver-api' for q in batch['queries']):fallback(batch)
 done=api('finish',batchId=batch['id']);log(mode=mode,staged=done['saved'],batchId=batch['id'],publicChanged=False)
except urllib.error.HTTPError as e:log(siteHttpStatus=e.code);sys.exit(1)
except Exception as e:log(error=type(e).__name__);sys.exit(1)
