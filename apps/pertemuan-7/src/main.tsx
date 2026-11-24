import './transition';
import { initGate } from './shell/gate';
import { installSpringEasing } from './motion/spring';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

initGate();
installSpringEasing();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
