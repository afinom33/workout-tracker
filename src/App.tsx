import React, { useState } from 'react';
import { Activity, Dumbbell, LineChart, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import WorkoutLogger from './components/WorkoutLogger';
import ProgressCharts from './components/ProgressCharts';
import ExportData from './components/ExportData';
import { useWorkoutStore } from './store/useWorkoutStore';

import { Moon, Sun } from 'lucide-react';

type View = 'dashboard' | 'workout' | 'progress' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const currentSession = useWorkoutStore((state) => state.currentSession);
  const theme = useWorkoutStore((state) => state.theme);
  const toggleTheme = useWorkoutStore((state) => state.toggleTheme);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleNavigation = (view: View) => {
    if (currentSession && view !== 'workout') {
      if (!window.confirm('Тренировка еще идет! Вы уверены, что хотите выйти из режима тренировки? (Данные сохранятся)')) {
        return;
      }
    }
    setCurrentView(view);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-textMain transition-colors duration-500">
      {/* Global Header actions */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full glass-panel hover:scale-110 transition-transform flex items-center justify-center text-primary"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-3xl mx-auto w-full p-4 md:p-6">
          {currentView === 'dashboard' && <Dashboard onStartWorkout={() => setCurrentView('workout')} />}
          {currentView === 'workout' && <WorkoutLogger onFinish={() => setCurrentView('dashboard')} />}
          {currentView === 'progress' && <ProgressCharts />}
          {currentView === 'settings' && <ExportData />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass-panel border-t-0 pb-safe z-50">
        <div className="max-w-3xl mx-auto flex justify-around p-3 relative">
          <NavItem 
            icon={<Activity size={24} />} 
            label="Обзор" 
            isActive={currentView === 'dashboard'} 
            onClick={() => handleNavigation('dashboard')} 
          />
          <NavItem 
            icon={<Dumbbell size={24} />} 
            label="Тренировка" 
            isActive={currentView === 'workout'} 
            onClick={() => handleNavigation('workout')}
            hasIndicator={!!currentSession}
          />
          <NavItem 
            icon={<LineChart size={24} />} 
            label="Прогресс" 
            isActive={currentView === 'progress'} 
            onClick={() => handleNavigation('progress')} 
          />
          <NavItem 
            icon={<Settings size={24} />} 
            label="Настройки" 
            isActive={currentView === 'settings'} 
            onClick={() => handleNavigation('settings')} 
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick, hasIndicator }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, hasIndicator?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full p-2 relative ${
        isActive ? 'text-primary' : 'text-textMuted hover:text-textMain'
      } transition-colors`}
    >
      {hasIndicator && (
        <span className="absolute top-1 right-1/4 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
      )}
      {icon}
      <span className="text-xs mt-1 font-medium">{label}</span>
    </button>
  );
}

export default App;
