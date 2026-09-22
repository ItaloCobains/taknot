import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import 'katex/dist/katex.min.css';
import './renderer/styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
