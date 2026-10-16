import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import './functional-redesign.css';
import './controls-polish.css';
import './brand.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
