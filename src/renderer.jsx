import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App.jsx';
import './renderer/styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
