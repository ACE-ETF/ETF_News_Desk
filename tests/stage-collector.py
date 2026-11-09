"""Exercise the actual collector offline: no provider or Site requests."""
import contextlib,io,json,runpy,unittest,urllib.error,urllib.parse
from unittest.mock import patch
from pathlib import Path

class Reply(io.BytesIO):
 def __init__(self,data):super().__init__(data.encode())
 def __enter__(self):return self
 def __exit__(self,*args):self.close()

def collect(google=503,search_error=None,article_error=None,mode='stage',skipped=False):
 calls=[];pauses=[];saves=[];actions=[]
 batch={'id':'stage-123','mode':mode,'start':'2026-11-08T00:00:00+00:00','end':'2026-11-09T09:00:00+00:00','queries':[{'q':'ETF','hl':'ko','gl':'KR','ceid':'KR:ko'}]}
 def site_open(req,timeout):
  body=json.loads(req.data);actions.append(body)
  assert req.get_header('Oai-sites-authorization')=='Bearer secret'
  action=body['action']
  if action=='start':result={'skipped':True} if skipped else {'batch':batch}
  elif action=='reserve':result={'reserved':True}
  elif action=='reserveFallback':result={'reserved':True,'maxItems':20 if mode=='stage' else 30}
  elif action=='fallback':saves.extend(body['items']);result={'saved':len(body['items'])}
  elif action=='feed':result={'saved':google}
  else:result={'saved':len(saves)}
  return Reply(json.dumps(result))
 def external(url,timeout):
  # external() receives a bare provider URL, with no Site authentication headers.
  assert isinstance(url,str) and 'secret' not in url
  calls.append(url)
  if 'news.google.com' in url:
   if google==503:raise urllib.error.HTTPError(url,503,'unavailable',None,None)
   return Reply('<rss><channel></channel></rss>')
  if 'search.naver.com' in url:
   if search_error:raise urllib.error.HTTPError(url,search_error,'limited',None,None)
   i=sum('search.naver.com' in u for u in calls)
   return Reply(''.join(f'<a href="https://n.news.naver.com/mnews/article/001/{i*100+n}">x</a>' for n in range(40)))
  if article_error:raise urllib.error.HTTPError(url,article_error,'limited',None,None)
  return Reply('<meta property="og:title" content="미국 상장 ETF 신규 상품 투자 전략"><meta property="og:article:author" content="테스트경제"><span data-date-time="2026-11-09T16:00:00+09:00"></span>')
 fake=type('Site',(),{'open':staticmethod(site_open)})()
 with patch('sys.stdin',io.StringIO(json.dumps({'url':'https://site.example','token':'secret','mode':mode})+'\n')),patch('urllib.request.build_opener',return_value=fake),patch('urllib.request.urlopen',side_effect=external),patch('time.sleep',side_effect=pauses.append),contextlib.redirect_stdout(io.StringIO()):
  try:runpy.run_path(str(Path(__file__).parents[1]/'public/collector.py'),run_name='__main__')
  except SystemExit as e:assert e.code==0
 return calls,pauses,saves,actions

class CollectorTests(unittest.TestCase):
 def test_stage_failed_google_bounded_fallback(self):
  calls,pauses,saves,actions=collect()
  self.assertEqual(sum('news.google.com' in u for u in calls),1)
  self.assertEqual(sum('search.naver.com' in u for u in calls),2)
  self.assertEqual(len(saves),20)
  self.assertEqual(len([a for a in actions if a['action']=='fallback']),2)
  self.assertTrue(all(n>=5 for n in pauses))
  self.assertEqual(saves[0]['published'],'2026-11-09T16:00:00+09:00')
  self.assertEqual(actions[-1]['action'],'finish')
 def test_provider_block_stops_search_and_articles(self):
  for code in (403,429,502,503):
   calls,_,saves,actions=collect(search_error=code)
   self.assertEqual(len(calls),2);self.assertFalse(saves)
   self.assertEqual(actions[-2]['code'],code)
 def test_article_block_stops_remaining_articles(self):
  calls,_,saves,actions=collect(article_error=503)
  self.assertEqual(len(calls),4);self.assertFalse(saves)
  self.assertEqual(actions[-2]['code'],503)
 def test_healthy_feed_does_not_fallback(self):
  calls,_,_,actions=collect(google=1)
  self.assertEqual(len(calls),1)
  self.assertNotIn('reserveFallback',[a['action'] for a in actions])
 def test_empty_feed_fallback_and_release_budget(self):
  self.assertEqual(len(collect(google=0)[2]),20)
  calls,_,saves,_=collect(mode='release')
  self.assertEqual(sum('search.naver.com' in u for u in calls),3);self.assertEqual(len(saves),30)
 def test_duplicate_has_no_provider_requests(self):
  calls,_,_,_=collect(skipped=True);self.assertFalse(calls)

if __name__=='__main__':unittest.main()
