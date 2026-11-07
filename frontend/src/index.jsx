import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // R3F 8 schedules forceContextLoss on Canvas effect teardown, including React
  // 18 StrictMode's development replay. Use one real Canvas lifecycle here.
  <App />
);
