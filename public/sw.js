var C='ps-v3',F=['./','index.html','style.css','app.js','map.js','icon.svg'];
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(F)}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}))});
self.addEventListener('fetch',function(e){var u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.indexOf('/api/')===0)return;e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(C).then(function(h){h.put(e.request,c)});return r}).catch(function(){return caches.match(e.request)}))});
