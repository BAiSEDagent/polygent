import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Agent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  pnl: number;
  tradesToday: number;
  lastTrade?: string;
}

interface DashboardState {
  // Agents
  agents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgent: (id: string) => void;
  
  // Theme
  theme: 'dark' | 'light' | 'midnight' | 'dracula' | 'nord';
  setTheme: (theme: string) => void;
  
  // Keyboard shortcuts
  shortcutsEnabled: boolean;
  toggleShortcuts: () => void;
  
  // WebSocket connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
  
  // Actions
  updateAgent: (id: string, updates: Partial<Agent>) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      agents: [],
      selectedAgentId: null,
      setSelectedAgent: (id) => set({ selectedAgentId: id }),
      
      theme: 'dark',
      setTheme: (theme) => set({ theme: theme as any }),
      
      shortcutsEnabled: true,
      toggleShortcuts: () => set((s) => ({ shortcutsEnabled: !s.shortcutsEnabled })),
      
      isConnected: false,
      setConnected: (connected) => set({ isConnected: connected }),
      
      updateAgent: (id, updates) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      })),
    }),
    {
      name: 'polygent-dashboard',
      partialize: (state) => ({ 
        theme: state.theme, 
        shortcutsEnabled: state.shortcutsEnabled 
      }),
    }
  )
);

// Keyboard shortcut hook
export function useKeyboardShortcuts() {
  const { agents, setSelectedAgent, shortcutsEnabled } = useDashboardStore();
  
  useEffect(() => {
    if (!shortcutsEnabled) return;
    
    const handler = (e: KeyboardEvent) => {
      // Cmd+1-9: Switch agents
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (agents[index]) {
          setSelectedAgent(agents[index].id);
        }
      }
      
      // Cmd+K: Add agent (placeholder)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // TODO: Open add agent modal
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [agents, setSelectedAgent, shortcutsEnabled]);
}

import { useEffect } from 'react';