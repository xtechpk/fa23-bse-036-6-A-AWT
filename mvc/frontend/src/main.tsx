import React from 'react';
import ReactDOM from 'react-dom/client'; // React 18+ uses this import
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!); // Ensure root exists

root.render(
  <React.StrictMode >
    
    <App />

  </React.StrictMode>
);
