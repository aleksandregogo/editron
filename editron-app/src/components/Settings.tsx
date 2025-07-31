import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "../utils/api";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  authProvider: string;
  isGoogleApiConnected?: boolean;
}

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeVerifier, setCodeVerifier] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    console.log("Setting up gmail_api_code_received event listener");
    const unlisten = listen("gmail_api_code_received", async (event) => {
      console.log("Received gmail_api_code_received event:", event);
      const code = event.payload as string;
      console.log("Code received:", code ? code.substring(0, 20) + "..." : "no code");
      console.log("Code verifier available:", !!codeVerifier);
      if (code && codeVerifier) {
        console.log("Exchanging Google API code...");
        await exchangeGoogleApiCode(code, codeVerifier);
      } else {
        console.log("Missing code or codeVerifier:", { code: !!code, codeVerifier: !!codeVerifier });
      }
    });

    return () => {
      console.log("Cleaning up gmail_api_code_received event listener");
      unlisten.then(f => f());
    };
  }, [codeVerifier]);

  const fetchProfile = async () => {
    try {
      console.log("Fetching updated profile...");
      const profileResponse = await invoke<UserProfile>("get_profile");
      console.log("Profile updated:", profileResponse);
      console.log("isGoogleApiConnected:", profileResponse.isGoogleApiConnected);
      setProfile(profileResponse);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setLoading(true);
      console.log("Starting Gmail API connection flow...");
      const verifier = await invoke<string>("start_gmail_api_connect_flow");
      console.log("Received code verifier from Tauri:", verifier ? verifier.substring(0, 20) + "..." : "no verifier");
      setCodeVerifier(verifier);
      console.log("Code verifier set in state");
    } catch (error) {
      console.error("Error starting Gmail API connection:", error);
      setLoading(false);
    }
  };

  const exchangeGoogleApiCode = async (code: string, verifier: string) => {
    try {
      const response = await apiClient.post('/api/v1/google-api/exchange-code', {
        code,
        codeVerifier: verifier,
        redirectUri: "http://localhost:8080/auth/google-api-callback",
      });

      console.log("Google API code exchange successful:", response);
      
      // Clear the code verifier first
      setCodeVerifier(null);
      
      // Then fetch the updated profile
      await fetchProfile();
      
      console.log("Gmail API connection completed successfully!");
    } catch (error) {
      console.error("Error exchanging Google API code:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      setLoading(true);
      console.log("Disconnecting Gmail API...");
      
      const response = await apiClient.delete('/api/v1/google-api/disconnect');
      console.log("Gmail API disconnect successful:", response);
      
      await fetchProfile();
      console.log("Gmail API disconnected successfully!");
    } catch (error) {
      console.error("Error disconnecting Gmail API:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl bg-neutral-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Settings</h1>
        <p className="text-neutral-600">
          Manage your account settings and integrations.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-neutral-900">Account Information</CardTitle>
            <CardDescription>
              Your account details and authentication information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              {profile.profilePicture && (
                <img
                  src={profile.profilePicture}
                  alt={profile.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <h3 className="font-semibold text-neutral-900">{profile.name}</h3>
                <p className="text-sm text-neutral-600">{profile.email}</p>
                <Badge variant="secondary" className="mt-1">
                  {profile.authProvider}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-neutral-900">Integrations</CardTitle>
            <CardDescription>
              Connect external services to enhance your experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-neutral-900">Gmail API</h4>
                  <p className="text-sm text-neutral-600">
                    Connect your Gmail account for email composition and contact access.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {profile.isGoogleApiConnected ? (
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Connected
                    </Badge>
                    <Button
                      onClick={handleDisconnectGmail}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                      className="btn-secondary text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                    >
                      {loading ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectGmail}
                    disabled={loading}
                    className="btn-primary bg-red-600 hover:bg-red-700"
                  >
                    {loading ? "Connecting..." : "Connect Gmail"}
                  </Button>
                )}
              </div>
            </div>
            <Separator />
            <div className="text-sm text-neutral-600">
              <p>
                Connecting your Gmail account allows Editron to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Compose and send emails through Gmail</li>
                <li>Access your contacts for better integration</li>
                <li>Provide enhanced email-related features</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 