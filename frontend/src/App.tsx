import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Markets from './pages/Markets';
import AgentProfile from './pages/AgentProfile';
import Connect from './pages/Connect';
import { Landing } from './Landing';
import { SkillManifest } from './Skill';
import { Dashboard } from './Dashboard';
import { SovereignDashboard } from './pages/SovereignDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/skill" element={<SkillManifest />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:agentId" element={<SovereignDashboard />} />

        <Route element={<Layout />}>
          <Route path="/markets" element={<Markets />} />
          <Route path="/agents" element={<AgentProfile />} />
          <Route path="/connect" element={<Connect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
