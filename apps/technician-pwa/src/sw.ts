/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{url:string;revision?:string|null}> };
precacheAndRoute(self.__WB_MANIFEST); cleanupOutdatedCaches();
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",(event)=>{const p=event.data?.json()||{};event.waitUntil(self.registration.showNotification(p.title||"Home Services Technician",{body:p.body||"You have a job update",icon:"/icon-192.png",badge:"/icon-192.png",tag:p.tag||"technician",data:{path:p.path||"/technician/jobs"}}));});
self.addEventListener("notificationclick",(event)=>{event.notification.close();const raw=String(event.notification.data?.path||"/technician/jobs");const path=raw.startsWith("/technician")&&!raw.startsWith("//")?raw:"/technician/jobs";event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then((clients)=>{const existing=clients.find((client)=>new URL(client.url).origin===self.location.origin) as WindowClient|undefined;if(existing){void existing.navigate(path);return existing.focus();}return self.clients.openWindow(path);}));});
