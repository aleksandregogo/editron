import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder, FolderPlus, LogOut, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateProjectModal } from './CreateProjectModal';
import { RightSidebar } from './RightSidebar';
import { Toaster } from '@/components/ui/toaster';
import { apiClient } from '../utils/api';
import { getGlobalAgentRequest } from './EditorPage';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { invoke } from '@tauri-apps/api/core';

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
  onAgentRequest?: (promptText: string) => void;
}



const Layout = ({ profile, children, onLogout }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Get agent request function from global state if available
  const onAgentRequest = getGlobalAgentRequest() || undefined;

  // Extract document UUID from URL for editor pages
  let documentUuid: string | undefined;
  let projectUuid: string | undefined;
  
  // Handle both editor route patterns: /project/:projectUuid/editor/:uuid and /editor/:uuid
  if (location.pathname.includes('/project/') && location.pathname.includes('/editor/')) {
    // Pattern: /project/:projectUuid/editor/:uuid
    const pathParts = location.pathname.split('/');
    const projectIndex = pathParts.findIndex(part => part === 'project');
    const editorIndex = pathParts.findIndex(part => part === 'editor');
    
    if (projectIndex !== -1 && editorIndex !== -1 && editorIndex > projectIndex) {
      projectUuid = pathParts[projectIndex + 1];
      documentUuid = pathParts[editorIndex + 1];
    }
  } else if (location.pathname.includes('/editor/')) {
    // Pattern: /editor/:uuid
    documentUuid = location.pathname.split('/editor/')[1];
  } else if (location.pathname.includes('/project/')) {
    // Pattern: /project/:projectUuid (dashboard)
    projectUuid = location.pathname.split('/project/')[1]?.split('/')[0];
  }

  // Debug logging for agent request function
  useEffect(() => {
    console.log('Layout: onAgentRequest function:', {
      hasFunction: !!onAgentRequest,
      documentUuid,
      projectUuid,
      pathname: location.pathname
    });
  }, [onAgentRequest, documentUuid, projectUuid, location.pathname]);

  const shouldShowRightSidebar = useMemo(() => {
    // Show sidebar on project pages (both dashboard and editor)
    const isProjectPage = location.pathname.includes('/project/');
    const isEditorPage = location.pathname.includes('/editor/');
    const isProjectDashboard = location.pathname.includes('/project/') && !location.pathname.includes('/editor/');

    const result = isProjectPage || isEditorPage;

    console.log('Layout: shouldShowRightSidebar calculation:', {
      pathname: location.pathname,
      isProjectPage,
      isEditorPage,
      isProjectDashboard,
      shouldShow: result
    });

    return result;
  }, [location.pathname]);

  useEffect(() => {
    setShowRightSidebar(shouldShowRightSidebar);
  }, [shouldShowRightSidebar]);

  useEffect(() => {
    console.log('Layout: showRightSidebar state changed:', showRightSidebar);
  }, [showRightSidebar]);

  const handleLogout = async () => {
    try {
      await invoke("logout");
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
      onLogout();
    }
  };

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await apiClient.getProjects() as Project[];
      setProjects(fetchedProjects);

      // Set active project based on URL
      if (projectUuid && fetchedProjects.some(p => p.uuid === projectUuid)) {
        setActiveProjectId(projectUuid);
      } else if (fetchedProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(fetchedProjects[0].uuid);
      } else if (fetchedProjects.length === 0) {
        setActiveProjectId(null);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
      setActiveProjectId(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, projectUuid]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (projectUuid: string) => {
    setActiveProjectId(projectUuid);
    navigate(`/project/${projectUuid}`, { replace: true });
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Left Sidebar */}
      <div className={`flex flex-col bg-white border-r border-neutral-200 transition-all duration-300 ${isLeftSidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
        {/* User Profile Section */}
        <div className="p-4 border-b border-neutral-200 flex-shrink-0">
          {isLeftSidebarCollapsed ? (
            <div className="flex justify-center">
              <Avatar className="w-10 h-10">
                {profile?.profilePicture ? (
                  <AvatarImage src={profile.profilePicture} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-lg font-semibold">
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
                  <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-lg font-semibold">
                    {profile?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold mb-1 text-neutral-900 truncate">
                  {profile?.name}
                </h3>
                <p className="text-xs text-neutral-500 truncate">
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
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Projects
                </h4>
                <CreateProjectModal
                  onProjectCreated={(newProject) => {
                    if (newProject && newProject.uuid) {
                      setProjects(prev => [newProject, ...prev]);
                      setActiveProjectId(newProject.uuid);
                      // Navigate immediately to avoid any race conditions
                      window.location.href = `/project/${newProject.uuid}`;
                    }
                  }}
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </Button>
                  }
                />
              </div>
            )}

            {isLoading ? (
              <div className={`text-sm text-neutral-400 ${isLeftSidebarCollapsed ? 'text-center' : 'px-3'} py-2`}>
                {isLeftSidebarCollapsed ? '...' : 'Loading...'}
              </div>
            ) : projects.length === 0 ? (
              <div className={`text-sm text-neutral-400 ${isLeftSidebarCollapsed ? 'text-center' : 'px-3'} py-2`}>
                {isLeftSidebarCollapsed ? '...' : 'No projects'}
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.uuid}
                    className={`flex items-center w-full py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${isLeftSidebarCollapsed ? 'px-2 justify-center' : 'px-3'} ${activeProjectId === project.uuid
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
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
        <div className="border-t border-neutral-200 flex-shrink-0">
          <div className="flex flex-col">
            <Button
              onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              variant="ghost"
              size="sm"
              className="w-full h-12 rounded-none border-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              {isLeftSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              {!isLeftSidebarCollapsed && <span className="truncate ml-3">Collapse</span>}
            </Button>
            <Button
              onClick={() => navigate('/settings')}
              variant="ghost"
              size="sm"
              className="w-full h-12 rounded-none border-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Settings className="w-5 h-5" />
              {!isLeftSidebarCollapsed && <span className="truncate ml-3">Settings</span>}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-full h-12 rounded-none border-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <LogOut className="w-5 h-5" />
              {!isLeftSidebarCollapsed && <span className="truncate ml-3">Logout</span>}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showRightSidebar ? (isRightSidebarCollapsed ? 'mr-12' : 'mr-96') : ''
        }`}>
        {React.cloneElement(children as React.ReactElement, {
          refreshProjects: fetchProjects
        })}
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div className={`fixed top-0 right-0 h-screen bg-white border-l border-neutral-200 transition-all duration-300 z-30 ${isRightSidebarCollapsed ? 'w-12' : 'w-96'
          }`}>
          <RightSidebar
            isCollapsed={isRightSidebarCollapsed}
            onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
            documentUuid={documentUuid}
            projectUuid={projectUuid}
            onAgentRequest={onAgentRequest}
          />
        </div>
      )}

      <Toaster />
    </div>
  );
};

export default Layout; 