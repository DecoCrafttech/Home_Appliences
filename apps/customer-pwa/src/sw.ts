/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{url:string;revision?:string|null}> };
precacheAndRoute(self.__WB_MANIFEST); cleanupOutdatedCaches();
// Serve the cached app shell for customer routes on offline launches and reloads.
// Never turn API or missing asset requests into HTML responses.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), {
  denylist: [/^\/api(?:\/|$)/, /^\/\.well-known(?:\/|$)/, /^\/assets(?:\/|$)/, /\.[^/]+$/],
}));
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",(event)=>{const p=event.data?.json()||{};event.waitUntil(self.registration.showNotification(p.title||"Home Services",{body:p.body||"You have an update",icon:"/icon-192.png",badge:"/icon-192.png",tag:p.tag||"home-services",data:{path:p.path||"/requests"}}));});
self.addEventListener("notificationclick",(event)=>{event.notification.close();const raw=String(event.notification.data?.path||"/requests");const path=raw.startsWith("/")&&!raw.startsWith("//")?raw:"/requests";event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then((clients)=>{const existing=clients.find((client)=>new URL(client.url).origin===self.location.origin) as WindowClient|undefined;if(existing){void existing.navigate(path);return existing.focus();}return self.clients.openWindow(path);}));});
