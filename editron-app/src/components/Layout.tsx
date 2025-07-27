import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, FolderPlus, Folder, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../utils/api';
import { CreateProjectModal } from './CreateProjectModal';
import { RightSidebar } from './RightSidebar';
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
  
  // Sidebar states
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Check if we're on a page that should show the right sidebar
  const shouldShowRightSidebar = location.pathname.includes('/project/') && 
    (location.pathname.includes('/editor/') || !!location.pathname.match(/\/project\/[^\/]+$/));

  // Extract document UUID and project UUID from URL
  const documentUuid = location.pathname.includes('/editor/') 
    ? location.pathname.split('/editor/')[1]?.split('/')[0] 
    : undefined;
  
  const projectUuid = location.pathname.includes('/project/') 
    ? location.pathname.split('/project/')[1]?.split('/')[0] 
    : undefined;

  useEffect(() => {
    setShowRightSidebar(shouldShowRightSidebar);
  }, [shouldShowRightSidebar]);

  const handleLogout = async () => {
    try {
      await invoke("logout");
      onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await apiClient.getProjects() as Project[];
      setProjects(fetchedProjects);
      
      if (!activeProjectId && fetchedProjects.length > 0) {
        setActiveProjectId(fetchedProjects[0].uuid);
      } else if (activeProjectId && !fetchedProjects.find(p => p.uuid === activeProjectId)) {
        setActiveProjectId(fetchedProjects.length > 0 ? fetchedProjects[0].uuid : null);
        if (fetchedProjects.length > 0) {
          navigate(`/project/${fetchedProjects[0].uuid}`);
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, navigate]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (projectUuid: string) => {
    setActiveProjectId(projectUuid);
    navigate(`/project/${projectUuid}`);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const layoutContext = {
    refreshProjects: fetchProjects,
    projects,
    activeProjectId,
    setActiveProjectId
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar */}
      <div className={`flex flex-col bg-gray-800 text-gray-50 border-r border-gray-700 transition-all duration-300 ${
        isLeftSidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* User Profile Section */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          {isLeftSidebarCollapsed ? (
            <div className="flex justify-center">
              <Avatar className="w-10 h-10">
                {profile?.profilePicture ? (
                  <AvatarImage src={profile.profilePicture} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {profile?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-10 h-10">
                {profile?.profilePicture ? (
                  <AvatarImage src={profile.profilePicture} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {profile?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold mb-1 text-gray-50 truncate">
                  {profile?.name}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Projects Section */}
        <div className="flex-1 py-4 overflow-y-auto">
          <div className="px-4">
            {!isLeftSidebarCollapsed && (
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
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-md"
                      >
                        <FolderPlus className="w-4 h-4" />
                      </Button>
                    }
                  />
              </div>
            )}
            
            {isLoading ? (
              <div className={`text-sm text-gray-400 ${isLeftSidebarCollapsed ? 'text-center' : 'px-3'} py-2`}>
                {isLeftSidebarCollapsed ? '...' : 'Loading...'}
              </div>
            ) : projects.length === 0 ? (
              <div className={`text-sm text-gray-400 ${isLeftSidebarCollapsed ? 'text-center' : 'px-3'} py-2`}>
                {isLeftSidebarCollapsed ? '...' : 'No projects'}
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.uuid}
                    className={`flex items-center w-full px-3 py-2.5 text-sm font-medium transition-colors rounded-md ${
                      activeProjectId === project.uuid
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                    }`}
                    onClick={() => handleProjectClick(project.uuid)}
                    title={isLeftSidebarCollapsed ? project.name : undefined}
                  >
                    <Folder className="w-5 h-5 flex-shrink-0" />
                    {!isLeftSidebarCollapsed && (
                      <span className="truncate ml-3">{project.name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Actions */}
        <div className="border-t border-gray-700 flex-shrink-0">
          <div className="flex flex-col">
            <Button 
              onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              variant="ghost" 
              size="sm"
              className="w-full h-12 rounded-none border-0 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            >
              {isLeftSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm"
              className="w-full h-12 rounded-none border-0 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        showRightSidebar ? (isRightSidebarCollapsed ? 'mr-12' : 'mr-96') : ''
      }`}>
        {React.cloneElement(children as React.ReactElement, { 
          refreshProjects: fetchProjects 
        })}
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div className={`fixed top-0 right-0 h-screen bg-card border-l border-border transition-all duration-300 z-30 ${
          isRightSidebarCollapsed ? 'w-12' : 'w-96'
        }`}>
          <RightSidebar 
            isCollapsed={isRightSidebarCollapsed}
            onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
            documentUuid={documentUuid}
            projectUuid={projectUuid}
          />
        </div>
      )}
      
      <Toaster />
    </div>
  );
};

export default Layout; 