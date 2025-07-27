import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, FolderPlus, Folder } from 'lucide-react';
import { apiClient } from '../utils/api';
import { CreateProjectModal } from './CreateProjectModal';
import { Toaster } from '@/components/ui/toaster';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  profilePicture?: string;
  authProvider: string;
}

interface Project {
  uuid: string;
  name: string;
  description?: string;
  customInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

interface LayoutProps {
  profile: UserProfile;
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout = ({ profile, children, onLogout }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await invoke("logout");
      onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await apiClient.getProjects() as Project[];
      setProjects(fetchedProjects);
      
      // Set first project as active if none is set
      if (!activeProjectId && fetchedProjects.length > 0) {
        setActiveProjectId(fetchedProjects[0].uuid);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleProjectClick = (projectUuid: string) => {
    setActiveProjectId(projectUuid);
    navigate(`/project/${projectUuid}`);
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
          {/* Projects Section */}
          <div className="px-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Projects
              </h4>
              <CreateProjectModal
                onProjectCreated={(newProject) => {
                  setProjects(prev => [newProject, ...prev]);
                  setActiveProjectId(newProject.uuid);
                  navigate(`/project/${newProject.uuid}`);
                }}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </Button>
                }
              />
            </div>
            
            {isLoading ? (
              <div className="text-sm text-gray-400 px-3 py-2">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-gray-400 px-3 py-2">
                No projects yet. Create your first project!
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.uuid}
                    className={`flex items-center w-full px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                      activeProjectId === project.uuid
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                    }`}
                    onClick={() => handleProjectClick(project.uuid)}
                  >
                    <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
      <Toaster />
    </div>
  );
};

export default Layout; 