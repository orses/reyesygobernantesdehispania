import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import { AppErrorBoundary } from './components/app-error-boundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se ha encontrado el elemento raíz donde montar la aplicación.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <AppErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </AppErrorBoundary>
);
