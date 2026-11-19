"""Exercise the actual workflow routing with a fixed KST clock and saved state."""
from datetime import datetime
import importlib.util
import os
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pipeline',ROOT/'scripts/static-news.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
workflow=(ROOT/'.github/workflows/pages.yml').read_text()
code=workflow.split('      - name: Choose collection or release',1)[1].split("python - <<'PY'\n",1)[1].split('          PY',1)[0]
code='\n'.join(line[10:] for line in code.splitlines())
class Clock(datetime):
    @classmethod
    def now(cls,tz=None):return cls(2026,11,20,7,55,tzinfo=m.KST).astimezone(tz)
class FakeSpec:
    loader=type('Loader',(),{'exec_module':lambda self,module:None})()
expected=m.window(Clock.now(m.UTC),set())
valid={'windowEnd':expected['end'],'requestedAt':'2026-11-19T22:50:00.000Z','mode':'release'}
cases=[
    ('stale edition recovers missing collection','push','',False,valid,'release','release'),
    ('stored-only recovery never refetches','push','',False,{**valid,'mode':'stored-release'},'stored-release','stored-release'),
    ('healthy edition ignores retry','push','',True,valid,'stored-release','stored-release'),
    ('wrong edition rejected','push','',False,{**valid,'windowEnd':'2026-11-18T22:40:00.000Z'},'stored-release','stored-release'),
    ('expired request rejected','push','',False,{**valid,'requestedAt':'2026-11-19T22:00:00.000Z'},'stored-release','stored-release'),
    ('future request rejected','push','',False,{**valid,'requestedAt':'2026-11-19T23:00:00.000Z'},'stored-release','stored-release'),
    ('invalid timestamp rejected','push','',False,{**valid,'requestedAt':None},'stored-release','stored-release'),
    ('primary schedule preserved','schedule','40 22 * * 0-4',False,valid,'release','release'),
    ('stage collection retains publication recovery','schedule','10 4,10,16,22 * * *',False,valid,'stage','stored-release'),
]
with tempfile.TemporaryDirectory() as directory:
    for name,event,schedule,healthy,retry,want_mode,want_pub in cases:
        output=Path(directory)/'out';output.write_text('')
        def read(path,default):
            if str(path).endswith('publication-retry.json'):return retry
            if str(path).endswith('public/latest.json'):return {'window':expected if healthy else {}}
            if str(path).endswith('state.json'):return m.new_state()
            return default
        with patch.dict(os.environ,EVENT_NAME=event,EVENT_SCHEDULE=schedule,GITHUB_OUTPUT=str(output)),patch('importlib.util.spec_from_file_location',return_value=FakeSpec()),patch('importlib.util.module_from_spec',return_value=m),patch.object(m,'datetime',Clock),patch.object(m,'read',side_effect=read),patch.object(m,'holidays',return_value=set()):
            exec(code,{})
        result=dict(line.split('=',1) for line in output.read_text().splitlines())
        assert result['mode']==want_mode and result['publication_mode']==want_pub,(name,result)
print('PASS: 9 publication recovery, freshness, mode and request-expiration scenarios')
