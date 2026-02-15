import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Arena from './pages/Arena';
import Markets from './pages/Markets';
import AgentProfile from './pages/AgentProfile';
import Connect from './pages/Connect';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Arena />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/agents" element={<AgentProfile />} />
          <Route path="/connect" element={<Connect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
