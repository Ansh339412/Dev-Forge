import '@fontsource-variable/instrument-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { Toasts } from './components/Toasts';
import './index.css';
import { queryClient } from './lib/queryClient';

const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <Router>
          <App />
        </Router>
        <Toasts />
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
