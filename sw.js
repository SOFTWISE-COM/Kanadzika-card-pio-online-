const CACHE='kanandzika-v28';
const FILES=['./','index.html','home.html','entregador.html','manifest.json','manifest-entregador.json','rastreio.js','icones.js','perfil.js','foto.js','assets/logo.png','assets/splash.jpg','assets/intro1.png','assets/intro2.png','assets/batata.png','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>fetch(f,{redirect:'follow'}).then(r=>{if(r.ok&&!r.redirected)return c.put(f,r)}).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin)||e.request.url.includes('admin'))return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r&&r.ok&&!r.redirected){const c=r.clone();caches.open(CACHE).then(ch=>ch.put(e.request,c));}return r;}).catch(()=>hit);
    if(hit&&hit.redirected)return net;
    return hit||net;
  }));
});

self.addEventListener('notificationclick',e=>{e.notification.close();const alvo=(e.notification.data&&e.notification.data.url)||'home.html';e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if(c.url.includes(alvo)&&'focus' in c)return c.focus();}return self.clients.openWindow(alvo);}));});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(_){d={title:'Kanandzika',body:e.data?e.data.text():''};}
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    const aberta=l.find(c=>c.visibilityState==='visible');
    if(aberta){l.forEach(c=>c.postMessage({type:'push'}));return;} // app à frente: o próprio app mostra o aviso por cima
    return self.registration.showNotification(d.title||'Kanandzika',{body:d.body||'',icon:'assets/icon-192.png',badge:'assets/icon-192.png',tag:d.tag||undefined,renotify:!!d.tag,data:{url:d.url||'home.html'}});
  }));
});
