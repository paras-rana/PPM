import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { PpmProjectsProvider } from './ppm/PpmProjectsContext.jsx';

// React entry point.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PpmProjectsProvider>
        <App />
      </PpmProjectsProvider>
    </AuthProvider>
  </StrictMode>,
);
