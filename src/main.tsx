import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-expect-error CSS import handled by Vite
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
