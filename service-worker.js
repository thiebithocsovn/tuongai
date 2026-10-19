/* Tường học tập AI PWA: tuyệt đối không cache API, auth, bài làm hay phản hồi cá nhân. */
const CACHE='tuongai-public-shell-v1';
const SAFE_ASSETS=['/tuongai/offline.html','/tuongai/app-icon.svg','/tuongai/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SAFE_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('tuongai-public-shell-')&&key!==CACHE)await caches.delete(key);}await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin||!u.pathname.startsWith('/tuongai/'))return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).catch(async()=> (await caches.match('/tuongai/offline.html'))||Response.error()));
   return;
 }
 if(!SAFE_ASSETS.includes(u.pathname))return;
 event.respondWith(caches.match(req).then(x=>x||fetch(req)));
});
