import {env} from 'cloudflare:workers';
export function collectorAuthorized(r:Request){const key=(env as unknown as {COLLECTOR_KEY?:string}).COLLECTOR_KEY;return !!key&&r.headers.get('X-Collector-Key')===key}
