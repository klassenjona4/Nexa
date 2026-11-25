import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { App } from './app/App';
import { startAppUpdates } from './lib/appUpdate';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

startAppUpdates();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
