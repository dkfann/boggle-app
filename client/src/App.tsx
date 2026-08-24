import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import RoomPage from './pages/RoomPage';
import DebugResults from './pages/DebugResults';

// `?debugResults=1` on any URL jumps straight to the results screen with
// fixture data - no room or finished round needed. Dev-only: the `DEV` check
// makes this dead code in a production build, so it can't ship as a shortcut
// past a real game. Temporary testing aid; safe to delete once done with it.
const DEBUG_RESULTS = import.meta.env.DEV && new URLSearchParams(window.location.search).has('debugResults');

export default function App() {
  if (DEBUG_RESULTS) return <DebugResults />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
