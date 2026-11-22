import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// A classic, bundled script: no imports or network requests at runtime.
createRoot(document.getElementById('root')!).render(<App />);

// The PWA build (dist/index.html) links a manifest and registers its Service Worker for offline start.
// The single-HTML build opened as a file has no manifest and never registers one.
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]') && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}); });
}
