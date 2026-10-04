/* Titiplen PWA public shell only. Private pages and API calls NEVER cached. */
const CACHE='titiplen-static-v1';
const PUBLIC_ASSETS=['/offline.html','/brand/titiplen-logo.webp'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('titiplen-static-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  // Always network for page navigation, especially any account/session/admin page.
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));
    return;
  }
  // Cache only immutable publicly deployed bundles and publicly branded assets.
  if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/brand/')){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
      if(response.ok&&response.type==='basic'){
        const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(req,copy));
      }
      return response;
    })));
  }
});
