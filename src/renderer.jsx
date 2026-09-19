import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App.jsx';
import 'katex/dist/katex.min.css';
import './renderer/styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
