import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { registerServiceWorker } from './services/pwa';
import './index.css';

// HashRouter: GitHub Pages has no server-side rewrites, so hash routes keep
// deep links and installed-PWA launches working without a 404.html hack.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>,
);

registerServiceWorker();
