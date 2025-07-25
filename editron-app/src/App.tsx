import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import EditorPage from "./components/EditorPage";
import { Button } from "@/components/ui/button";

interface UserProfile {
  id: number;
  email: string;
  name: string;
  profilePicture?: string;
  authProvider: string;
}

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/80 to-primary p-5">
        <div className="bg-card border border-border rounded-2xl shadow-xl text-center max-w-md w-full p-12">
          <h1 className="text-4xl font-bold mb-2 text-card-foreground">Welcome to Editron</h1>
          <p className="text-muted-foreground mb-8 text-base">Please sign in to continue</p>
          <Button onClick={handleLogin} className="w-full gap-3" size="lg">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {profile && (
        <Layout profile={profile} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/editor/:uuid" element={<EditorPage />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}

export default App;
