import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Bot, BookOpen, Trophy, Eye, Users } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/lobby', label: 'Início', icon: Home },
    { path: '/online', label: 'Online', icon: Users },
    { path: '/bot', label: 'Robô', icon: Bot },
    { path: '/tutorial', label: 'Aprender', icon: BookOpen },
    { path: '/ranking', label: 'Ranking', icon: Trophy },
    { path: '/live', label: 'Ao Vivo', icon: Eye }
  ];

  return (
    <div className="bottom-nav glass-panel">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(item.path);
        
        return (
          <button 
            key={item.path} 
            onClick={() => navigate(item.path)}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={24} className={isActive ? 'icon-active' : 'icon-inactive'} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
