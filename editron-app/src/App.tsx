import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Layout from "./components/Layout";
import EditorPage from "./components/EditorPage";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "./components/CreateProjectModal";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  picture: string;
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

// Component to handle root route logic
const RootHandler = ({ 
  projects, 
  firstProject, 
  onRefreshProjects 
}: { 
  projects: Project[]; 
  firstProject: Project | undefined; 
  onRefreshProjects: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Refresh projects when landing on root
    onRefreshProjects();
  }, [location.pathname, onRefreshProjects]);

  useEffect(() => {
    // Redirect to first project if available
    if (firstProject && firstProject.uuid && projects.length > 0) {
      // Double-check that the firstProject is actually in the projects array
      const projectExists = projects.some(p => p.uuid === firstProject.uuid);
      if (projectExists) {
        navigate(`/project/${firstProject.uuid}`, { replace: true });
      } else {
        // If the firstProject is not in the projects array, use the first available project
        const firstAvailableProject = projects[0];
        if (firstAvailableProject && firstAvailableProject.uuid) {
          navigate(`/project/${firstAvailableProject.uuid}`, { replace: true });
        }
      }
    }
  }, [firstProject, navigate, projects]);

  // If no projects, this will be handled by the App component's conditional rendering
  return null;
};

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const checkInitialLogin = async () => {
      try {
        const isLogged = await invoke<boolean>("check_login");
        setLoggedIn(isLogged);
        if (isLogged) {
          console.log("🔍 DEBUG: Fetching profile from Tauri...");
          const profileResponse = await invoke<UserProfile>("get_profile");
          console.log("🔍 DEBUG: Profile response received:", profileResponse);
          setProfile(profileResponse);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        setLoggedIn(false);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkInitialLogin();

    // Listen for authentication events
    const unlistenSuccess = listen("login_success", async () => {
      try {
        setLoggedIn(true);
        console.log("🔍 DEBUG: Login success, fetching profile...");
        const profileResponse = await invoke<UserProfile>("get_profile");
        console.log("🔍 DEBUG: Profile after login:", profileResponse);
        setProfile(profileResponse);
      } catch (error) {
        console.error("Error getting profile after login:", error);
      }
    });

    const unlistenFailed = listen("login_failed", (e) => {
      console.error("Login failed:", e.payload);
      setLoggedIn(false);
      setProfile(null);
    });

    const unlistenLogout = listen("logout_success", () => {
      setLoggedIn(false);
      setProfile(null);
    });

    return () => {
      unlistenSuccess.then(f => f());
      unlistenFailed.then(f => f());
      unlistenLogout.then(f => f());
    };
  }, []);

  useEffect(() => {
    // Fetch projects after login
    if (loggedIn) {
      fetchProjects();
    }
  }, [loggedIn]);

  const fetchProjects = async () => {
    try {
      const { apiClient } = await import('./utils/api');
      const projects = await apiClient.getProjects() as Project[];
      setProjects(projects);
      
      if (projects.length === 0) {
        // Check if this is the first time user (welcome message)
        const hasSeenWelcome = localStorage.getItem('editron_welcome_seen');
        if (!hasSeenWelcome) {
          setShowWelcome(true);
          // Auto-open project creation immediately
          setShowCreateProject(true);
        } else {
          // Returning user without projects - show project creation immediately
          setShowCreateProject(true);
        }
      } else {
        setShowCreateProject(false);
        setShowWelcome(false);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
      const hasSeenWelcome = localStorage.getItem('editron_welcome_seen');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
        setShowCreateProject(true);
      } else {
        setShowCreateProject(true);
      }
    }
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    setShowCreateProject(true);
    localStorage.setItem('editron_welcome_seen', 'true');
  };

  const handleProjectCreated = async (newProject?: Project) => {
    setShowCreateProject(false);
    setShowWelcome(false);
    
    // If we have a new project, navigate to it immediately
    if (newProject && newProject.uuid) {
      // Navigate immediately to avoid any race conditions
      window.location.href = `/project/${newProject.uuid}`;
    } else {
      // Fallback: refresh projects and let RootHandler handle navigation
      await fetchProjects();
    }
  };

  const handleLogin = async () => {
    try {
      await invoke("start_login_flow");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Welcome to Editron</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your AI-powered document editor and collaborator
          </p>
          <Button onClick={handleLogin} size="lg" className="px-8 py-3">
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  // Welcome message (first time only)
  if (showWelcome && profile) {
    return (
      <Router>
        <Layout profile={profile} onLogout={() => setLoggedIn(false)}>
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <div className="bg-card border border-border rounded-2xl shadow-xl text-center max-w-2xl w-full p-12">
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-4 text-card-foreground">Welcome to Editron! 🎉</h1>
                <p className="text-lg text-muted-foreground mb-6">
                  You're all set up! To get started, create your first project to organize your documents and collaborate with AI.
                </p>
                <div className="bg-muted/50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-card-foreground">What you can do with projects:</h3>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Organize documents by project or topic
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Set custom AI instructions for each project
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Keep project-specific chat context
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Upload and edit documents within projects
                    </li>
                  </ul>
                </div>
              </div>
              <Button onClick={handleWelcomeClose} size="lg" className="px-8 py-3">
                Create My First Project
              </Button>
            </div>
          </div>
        </Layout>
      </Router>
    );
  }

  // Project creation modal (for users without projects)
  if (showCreateProject && profile) {
    return (
      <Router>
        <Layout profile={profile} onLogout={() => setLoggedIn(false)}>
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <div className="bg-card border border-border rounded-2xl shadow-xl text-center max-w-md w-full p-12">
              <h2 className="text-2xl font-bold mb-4 text-card-foreground">Create Your First Project</h2>
              <p className="text-muted-foreground mb-8">
                Get started by creating a project to organize your documents.
              </p>
              <CreateProjectModal
                isOpen={true}
                onOpenChange={(open) => setShowCreateProject(open)}
                onProjectCreated={handleProjectCreated}
              />
            </div>
          </div>
        </Layout>
      </Router>
    );
  }

  // Redirect root to first project if available
  const firstProject = projects[0];

  return (
    <Router>
      {profile && (
        <Layout profile={profile} onLogout={() => setLoggedIn(false)}>
          <Routes>
            <Route path="/" element={
              <RootHandler 
                projects={projects} 
                firstProject={firstProject}
                onRefreshProjects={fetchProjects}
              />
            } />
            <Route path="/project/:projectUuid" element={<ProjectDashboard />} />
            <Route path="/project/:projectUuid/editor/:uuid" element={<EditorPage />} />
            <Route path="/editor/:uuid" element={<EditorPage />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}

export default App;
