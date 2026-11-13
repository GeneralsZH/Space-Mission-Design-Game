import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "mission-offline-cache",
      generateBundle(_options, bundle) {
        const assets = [
          "/",
          "/index.html",
          "/favicon.svg",
          ...Object.keys(bundle).map((file) => `/${file}`),
        ];
        const version = assets
          .join("")
          .split("")
          .reduce(
            (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0,
            0,
          );
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='mission-architect-${version}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>{const older=keys.filter(key=>key.startsWith('mission-architect-')&&key!==CACHE);return Promise.all(older.slice(0,-1).map(key=>caches.delete(key)));}).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error('Navigation unavailable');
      return caches.open(CACHE).then(cache=>{cache.put('/index.html',response.clone()).catch(()=>{});return response;});
    }).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html')).then(cached=>cached||Response.error())));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const current=await cache.match(request,{ignoreVary:true});if(current)return current;
    try{const response=await fetch(request),type=response.headers.get('content-type')||'';
      const valid=response.ok&&(!url.pathname.endsWith('.js')&&!url.pathname.endsWith('.css')||(url.pathname.endsWith('.css')?type.includes('text/css'):type.includes('javascript')||type.includes('ecmascript')));
      if(valid && /\\/assets\\//.test(url.pathname))await cache.put(request,response.clone()).catch(()=>{});if(valid)return response;
    }catch{}
    return /\\/assets\\//.test(url.pathname)?await caches.match(request,{ignoreVary:true})||Response.error():Response.error();
  }));
});`,
        });
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
