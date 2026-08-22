import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { GameProvider } from './game/GameProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* One socket for the whole app: navigating between the lobby and a
          round must not tear the connection down and re-join. */}
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </StrictMode>
);
