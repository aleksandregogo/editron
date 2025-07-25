import { useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogOut, FileText } from 'lucide-react';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  profilePicture?: string;
  authProvider: string;
}

interface LayoutProps {
  profile: UserProfile;
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout = ({ profile, children, onLogout }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await invoke("logout");
      onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-80 bg-gray-800 text-gray-50 flex flex-col border-r border-gray-700 fixed top-0 left-0 h-screen z-30">
        <div className="p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-12 h-12">
              {profile?.profilePicture ? (
                <AvatarImage src={profile.profilePicture} alt="Profile" />
              ) : (
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                  {profile?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold mb-1 text-gray-50 truncate">
                {profile?.name}
              </h3>
              <p className="text-sm text-gray-400 truncate">
                {profile?.email}
              </p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          <button 
            className={`flex items-center w-full px-6 py-3 text-sm font-medium transition-colors ${
              isActive('/dashboard') 
                ? 'bg-primary text-primary-foreground border-r-3 border-primary/80' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            }`}
            onClick={() => navigate('/dashboard')}
          >
            <FileText className="w-5 h-5 mr-2" />
            <span>Dashboard</span>
          </button>
        </nav>
        
        <div className="p-6 border-t border-gray-700 flex-shrink-0">
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-h-screen ml-80 bg-background">
        {children}
      </main>
    </div>
  );
};

export default Layout; 