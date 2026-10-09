const CACHE='kanandzika-v14';
const FILES=['./','index.html','home.html','manifest.json','rastreio.js','icones.js','foto.js','assets/logo.png','assets/intro1.png','assets/intro2.png','assets/intro3.png','assets/batata.png','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin)||e.request.url.includes('admin'))return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(CACHE).then(ch=>ch.put(e.request,c));}return r;}).catch(()=>hit);
    return hit||net;
  }));
});
