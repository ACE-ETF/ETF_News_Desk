"""ETF Desk bounded scheduled collector. Credentials are read from hidden stdin only."""
import sys,json,urllib.request,urllib.error,urllib.parse,time,datetime,re,html,termios
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
 lo=datetime.datetime.fromisoformat(batch['start']);hi=datetime.datetime.fromisoformat(batch['end']);kst=datetime.timezone(datetime.timedelta(hours=9));urls=[];items=[]
 for q in ['ETF -비트코인 -이더리움 -가상자산 -암호화폐','ACE ETF','상장지수펀드']:
  time.sleep(5)
  params={'where':'news','query':q,'sort':'1','pd':'3','ds':lo.astimezone(kst).strftime('%Y.%m.%d'),'de':hi.astimezone(kst).strftime('%Y.%m.%d')}
  try:
   s=external('https://search.naver.com/search.naver?'+urllib.parse.urlencode(params));p=Links();p.feed(s);urls+=p.urls
  except urllib.error.HTTPError as e:
   log(fallbackSearchStatus=e.code)
   if e.code in [403,429,503]:break
  except Exception as e:log(fallbackSearchError=type(e).__name__)
 for url in list(dict.fromkeys(urls))[:30]:
  time.sleep(3)
  try:
   s=external(url,700000);p=Meta();p.feed(s);title=p.meta.get('og:title') or '';source=(p.meta.get('og:article:author') or '').split(' | ')[0]
   stamp=p.stamps[0] if p.stamps else None
   if not stamp or not source or not re.search(r'ETF|상장지수펀드',title,re.I):continue
   published=datetime.datetime.fromisoformat(stamp).replace(tzinfo=kst)
   if not lo<=published<hi:continue
   items.append({'title':title,'url':url,'source':source,'published':published.isoformat()})
  except urllib.error.HTTPError as e:
   log(fallbackArticleStatus=e.code)
   if e.code in [403,429,503]:break
  except Exception as e:log(fallbackArticleError=type(e).__name__)
 for i in range(0,len(items),10):
  if i:time.sleep(3)
  log(fallbackSaved=api('fallback',batchId=batch['id'],items=items[i:i+10]).get('saved',0))
 return len(items)
try:
 started=api('start',mode=mode)
 if started.get('skipped'):
  log(skipped=True,reason=started.get('reason'));sys.exit(0)
 batch=started['batch'];accepted=0;failed=False
 for i,query in enumerate(batch['queries']):
  if i:time.sleep(5)
  reservation=api('reserve',batchId=batch['id'],index=i)
  if reservation.get('skipped'):break
  try:
   # A one-time recovery may ingest already-fetched RSS without re-requesting Google.
   if i==0 and config.get('cachedRss'):
    with open(config['cachedRss']) as f:xml=f.read(2000001)
   else:xml=external('https://news.google.com/rss/search?'+urllib.parse.urlencode({k:query[k] for k in ('q','hl','gl','ceid')}))
  except urllib.error.HTTPError as e:
   api('failure',batchId=batch['id'],index=i,code=e.code);log(feed=i,httpStatus=e.code);failed=True
   if e.code in [403,429,502,503]:break
   continue
  except Exception as e:
   api('failure',batchId=batch['id'],index=i,code=0);log(feed=i,error=type(e).__name__);failed=True;break
  try:
   result=api('feed',batchId=batch['id'],index=i,xml=xml);accepted+=result['saved'];log(feed=i,**result)
  except urllib.error.HTTPError as e:
   if e.code in [401,403]:raise
   api('failure',batchId=batch['id'],index=i,code=0);log(feed=i,invalidRssOrSaveFailure=e.code);failed=True;break
 if mode=='release' and (failed or accepted==0):fallback(batch)
 done=api('finish',batchId=batch['id']);log(mode=mode,staged=done['saved'],batchId=batch['id'],publicChanged=False)
except urllib.error.HTTPError as e:log(siteHttpStatus=e.code);sys.exit(1)
except Exception as e:log(error=type(e).__name__);sys.exit(1)
