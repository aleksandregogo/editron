import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Mail, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TiptapEditor from './TiptapEditor';
import { AgentReviewModal } from './Diff/AgentReviewModal';
import ComposeEmailModal from './Email/ComposeEmailModal';
import { apiClient } from '../utils/api';
import { useToast } from '../hooks/use-toast';

// Global state for agent request function
let globalAgentRequestFunction: ((promptText: string) => void) | null = null;

// Global state for adding messages to chat history
let globalAddMessageFunction: ((message: { role: 'user' | 'assistant'; content: string; mode?: 'chat' | 'agent' }) => void) | null = null;

export const setGlobalAgentRequest = (fn: ((promptText: string) => void) | null) => {
  globalAgentRequestFunction = fn;
};

export const getGlobalAgentRequest = () => globalAgentRequestFunction;

export const setGlobalAddMessage = (fn: ((message: { role: 'user' | 'assistant'; content: string; mode?: 'chat' | 'agent' }) => void) | null) => {
  globalAddMessageFunction = fn;
};

export const addMessageToChat = (message: { role: 'user' | 'assistant'; content: string; mode?: 'chat' | 'agent' }) => {
  if (globalAddMessageFunction) {
    globalAddMessageFunction(message);
  }
};

interface Document {
  uuid: string;
  title: string;
  content: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
  updatedAt: string;
  createdAt: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  authProvider: string;
  isGoogleApiConnected?: boolean;
}

const EditorPage = () => {
  const { uuid, projectUuid } = useParams<{ uuid: string; projectUuid?: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Agent Review Modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentDiffHtml, setAgentDiffHtml] = useState<string | null>(null);

  // Email Modal state
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  
  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (uuid) {
      fetchDocument();
      fetchUserProfile();
    }
  }, [uuid]);

  const fetchUserProfile = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const profile = await invoke<UserProfile>('get_profile');
      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchDocument = async () => {
    try {
      const doc = await apiClient.getDocument(uuid!, projectUuid) as Document;
      setDocument(doc);
      setError(null);
    } catch (error) {
      console.error('Error fetching document:', error);
      if (error instanceof Error && error.message.includes('404')) {
        setError('Document not found');
      } else {
        setError('Failed to load document');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = async (content: string) => {
    if (!document) return;

    // Update local state immediately for responsive UI
    setDocument(prev => prev ? { ...prev, content } : null);

    // Show saving indicator
    setIsSaving(true);
    
    try {
      await apiClient.updateDocument(document.uuid, { content }, projectUuid);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatLastSaved = () => {
    if (!lastSaved) return 'Unsaved changes';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
    
    if (diffInSeconds < 5) {
      return 'Saved just now';
    } else if (diffInSeconds < 60) {
      return `Saved ${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Saved ${minutes}m ago`;
    } else {
      return `Saved at ${lastSaved.toLocaleTimeString()}`;
    }
  };

  const handleAgentRequest = useCallback(async (promptText: string) => {
    if (!document) return;
    
    setIsAgentModalOpen(true);
    setIsAgentLoading(true);
    setAgentDiffHtml(null);
    
    try {
      const response = await apiClient.agentEdit(document.uuid, promptText, projectUuid) as any;
      setAgentDiffHtml(response.diffHtml);
      
      // Add agent response to chat history
      addMessageToChat({
        role: 'assistant',
        content: `I've analyzed your request and prepared the changes. Please review the proposed modifications below.`,
        mode: 'agent'
      });
    } catch (error) {
      console.error('Agent edit failed:', error);
      setIsAgentModalOpen(false);
      
      // Extract error message from backend response
      let errorMessage = 'Sorry, I encountered an error while processing your request. Please try again.';
      
      if (error instanceof Error) {
        const errorText = error.message;
        // Try to parse the error message to extract the backend response
        if (errorText.includes('API request failed:') && errorText.includes('{')) {
          try {
            // Extract the JSON part from the error message
            const jsonStart = errorText.indexOf('{');
            const jsonEnd = errorText.lastIndexOf('}') + 1;
            const jsonStr = errorText.substring(jsonStart, jsonEnd);
            const errorData = JSON.parse(jsonStr);
            
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
          }
        }
      }
      
      // Add error response to chat history
      addMessageToChat({
        role: 'assistant',
        content: errorMessage,
        mode: 'agent'
      });
    } finally {
      setIsAgentLoading(false);
    }
  }, [document?.uuid, projectUuid]);

  // Set global agent request function only after document is loaded
  useEffect(() => {
    if (document && document.uuid) {
      setGlobalAgentRequest(handleAgentRequest);
      return () => setGlobalAgentRequest(null);
    }
  }, [handleAgentRequest, document]);

  const handleAgentConfirm = async (finalContent: string) => {
    if (!document) return;
    
    try {
      await handleContentChange(finalContent);
      setIsAgentModalOpen(false);
      setAgentDiffHtml(null);
    } catch (error) {
      console.error('Failed to apply agent changes:', error);
    }
  };

  const handleAgentClose = () => {
    setIsAgentModalOpen(false);
    setAgentDiffHtml(null);
    setIsAgentLoading(false);
  };

  const handleDownloadPdf = async () => {
    if (!document) return;
    
    setIsDownloading(true);
    try {
      const blob = await apiClient.downloadPdf(document.uuid);
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${document.title}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Download Successful',
        description: 'Your document has been downloaded. Please check your Downloads folder.',
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'An error occurred while downloading the document.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-neutral-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center space-y-4">
          <div className="text-red-600 text-6xl font-bold">404</div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {error || 'Document not found'}
          </h1>
          <p className="text-neutral-600">
            The document you're looking for doesn't exist or has been moved.
          </p>
          <Button onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')} className="btn-primary gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (document.status === 'PROCESSING') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-semibold text-neutral-900">Processing Document</h2>
          <p className="text-neutral-600 max-w-md">
            Your document is being processed. This usually takes a few minutes. 
            Please check back shortly.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={fetchDocument} variant="outline" className="btn-secondary">
              Check Status
            </Button>
            <Button onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')} variant="ghost">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (document.status === 'ERROR') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center space-y-4">
          <div className="text-red-600 text-6xl">⚠️</div>
          <h2 className="text-xl font-semibold text-neutral-900">Processing Error</h2>
          <p className="text-neutral-600 max-w-md">
            There was an error processing your document. Please try uploading it again.
          </p>
          <Button onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')} className="btn-primary gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')}
              variant="ghost"
              size="sm"
              className="gap-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900 truncate max-w-md">
                {document.title}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              variant="outline"
              size="sm"
              className="btn-secondary gap-2"
            >
              {isDownloading ? (
                <>
                  <div className="w-3 h-3 border border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </Button>
            {userProfile?.isGoogleApiConnected && (
              <Button
                onClick={() => setIsComposeModalOpen(true)}
                variant="outline"
                size="sm"
                className="btn-secondary gap-2"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>{formatLastSaved()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto bg-white">
        <TiptapEditor
          initialContent={document.content}
          onContentChange={handleContentChange}
          editable={document.status === 'READY'}
        />
      </div>

      {/* Agent Review Modal */}
      <AgentReviewModal
        isOpen={isAgentModalOpen}
        isLoading={isAgentLoading}
        diffHtml={agentDiffHtml}
        onConfirm={handleAgentConfirm}
        onClose={handleAgentClose}
      />

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        documentTitle={document.title}
        documentUuid={document.uuid}
      />
    </div>
  );
};

export default EditorPage; 