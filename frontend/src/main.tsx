import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/industrial.css';

// Apply grid-bg class to body (dual major/minor electric-blue grid)
document.body.classList.add('grid-bg');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
