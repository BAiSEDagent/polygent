import React from 'react';
import { useDashboardStore } from '../store/dashboard';
import { useWebSocket } from '../hooks/useWebSocket';
import { AgentColumn } from './AgentColumn';
import { StatusBar } from './StatusBar';
import { ThemeSelector } from './ThemeSelector';

export function MultiColumnDashboard() {
  const { agents, theme } = useDashboardStore();
  useWebSocket();
  
  return (
    <div className={`min-h-screen bg-${theme} text-white`}>
      {/* Status Bar */}
      <StatusBar />
      
      {/* Multi-column layout */}
      <div className="flex overflow-x-auto h-[calc(100vh-64px)]">
        {agents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            No agents running. Start agents from CLI.
          </div>
        ) : (
          agents.map((agent, index) => (
            <AgentColumn 
              key={agent.id} 
              agent={agent} 
              index={index}
              className="w-80 min-w-80 border-r border-gray-800"
            />
          ))
        )}
      </div>
      
      {/* Theme Selector */}
      <ThemeSelector />
    </div>
  );
}

// Individual agent column
function AgentColumn({ agent, index, className }: { agent: any; index: number; className?: string }) {
  const { selectedAgentId, setSelectedAgent } = useDashboardStore();
  const isSelected = selectedAgentId === agent.id;
  
  return (
    <div 
      className={`${className} p-4 ${isSelected ? 'bg-gray-800' : ''}`}
      onClick={() => setSelectedAgent(agent.id)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm">
          <span className="text-gray-500">[{index + 1}]</span> {agent.name}
        </h3>
        <StatusBadge status={agent.status} />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">P&L:</span>
          <span className={agent.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            ${agent.pnl?.toFixed(2) || '0.00'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Trades Today:</span>
          <span>{agent.tradesToday || 0}</span>
        </div>
        
        {agent.lastTrade && (
          <div className="text-xs text-gray-500 mt-2">
            Last: {new Date(agent.lastTrade).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    error: 'bg-red-500',
  };
  
  return (
    <span className={`w-2 h-2 rounded-full ${colors[status as keyof typeof colors] || colors.stopped}`} />
  );
}