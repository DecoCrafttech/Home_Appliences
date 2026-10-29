import { useRegisterSW } from "virtual:pwa-register/react";
export function PwaUpdate() {
  const {
    needRefresh: [refresh, setRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return refresh ? (
    <div className="pwa-update" role="status">
      <span>A new version is ready.</span>
      <button onClick={() => updateServiceWorker(true)}>Update app</button>
      <button onClick={() => setRefresh(false)}>Later</button>
    </div>
  ) : null;
}
