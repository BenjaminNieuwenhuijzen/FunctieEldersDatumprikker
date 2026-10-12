import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { completeLinkLogin } from './lib/auth';
import './styles/index.css';

// Eerst een eventuele terugkeer via de inloglink afhandelen, dan pas de (hash)router starten.
void completeLinkLogin().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  ),
);
