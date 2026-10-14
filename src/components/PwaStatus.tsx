import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [registrationError, setRegistrationError] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setRegistrationError(true) });
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  if (online && !needRefresh) return null;
  return <aside className="pwa-status" aria-label="App connection and installation status">
    {!online && <span>Offline · saved products available</span>}
    {!online && registrationError && <span>Offline setup did not finish. Reconnect and reload the app using a secure website link.</span>}
    {needRefresh && <button onClick={() => { void updateServiceWorker(true); }}>Update app (finish edits first)</button>}
  </aside>;
}
