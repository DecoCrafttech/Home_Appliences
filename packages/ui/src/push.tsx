import { useEffect, useState } from "react";
import type { AxiosInstance } from "axios";
import axios from "axios";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function removeCurrentPushSubscription(api: AxiosInstance) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  try { await api.delete("/push/subscriptions", { data: { endpoint: subscription.endpoint } }); } finally { await subscription.unsubscribe(); }
}

export function PushNotificationSettings({ api }: { api: AxiosInstance }) {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
  useEffect(()=>{ if(!supported){setBusy(false);return;} navigator.serviceWorker.ready.then((r)=>r.pushManager.getSubscription()).then((s)=>setEnabled(Boolean(s))).finally(()=>setBusy(false)); },[supported]);
  async function turnOn(){
    setBusy(true); setMessage("");
    try {
      const permission=await Notification.requestPermission();
      if(permission!=="granted") throw new Error("Notifications were not allowed in browser settings.");
      const [{data},registration]=await Promise.all([api.get("/push/public-key"),navigator.serviceWorker.ready]);
      if(!data.data.available) throw new Error("Push notifications are not configured on the server.");
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(data.data.publicKey)});
      await api.post("/push/subscriptions",subscription.toJSON()); setEnabled(true); setMessage("Notifications are on for this device.");
    } catch(error:unknown){ const detail=axios.isAxiosError(error)?error.response?.data?.error?.message:error instanceof Error?error.message:null; setMessage(detail || "Could not enable notifications."); }
    finally{setBusy(false);}
  }
  async function turnOff(){ setBusy(true); setMessage(""); try{await removeCurrentPushSubscription(api);setEnabled(false);setMessage("Notifications are off for this device.");}catch{setMessage("Could not update notification settings.");}finally{setBusy(false);} }
  async function sendTest(){setBusy(true);setMessage("");try{const registration=await navigator.serviceWorker.ready;await registration.update();await api.post("/push/test");setMessage("Test notification sent. It may take a few seconds to appear.");}catch(error:unknown){const detail=axios.isAxiosError(error)?error.response?.data?.error?.message:error instanceof Error?error.message:null;setMessage(detail||"Could not send the test notification.");}finally{setBusy(false);}}
  return <section className="push-settings" aria-labelledby="push-settings-title"><div><strong id="push-settings-title">Push notifications</strong><p>Get request and appointment updates on this device.</p></div>{supported?<div className="push-settings-actions"><button type="button" disabled={busy} onClick={enabled?turnOff:turnOn}>{busy?"Checking…":enabled?"Turn off":"Turn on"}</button>{enabled&&<button type="button" disabled={busy} onClick={sendTest}>Send test notification</button>}</div>:<p>Push notifications are not supported by this browser.</p>}{message&&<p role="status">{message}</p>}</section>;
}
