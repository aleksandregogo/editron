import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TiptapEditor from './TiptapEditor';
import { ChatSidebar } from './Chat/ChatSidebar';
import { AgentReviewModal } from './Diff/AgentReviewModal';
import { apiClient } from '../utils/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock } from 'lucide-react';

interface Document {
  uuid: string;
  title: string;
  content: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
  updatedAt: string;
  createdAt: string;
}

const EditorPage = () => {
  const { uuid, projectUuid } = useParams<{ uuid: string; projectUuid?: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Agent Review Modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentDiffHtml, setAgentDiffHtml] = useState<string | null>(null);
  
  // Chat history refresh function - use useRef to avoid useState calling the function
  const refreshChatHistoryRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (uuid) {
      fetchDocument();
    }
  }, [uuid]);

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

  const handleAgentRequest = async (promptText: string) => {
    if (!document) return;
    
    setIsAgentModalOpen(true);
    setIsAgentLoading(true);
    setAgentDiffHtml(null);
    
    try {
      const response = await apiClient.agentEdit(document.uuid, promptText, projectUuid) as any;
      setAgentDiffHtml(response.diffHtml);
    } catch (error) {
      console.error('Agent edit failed:', error);
      // TODO: Show error toast
      setIsAgentModalOpen(false);
    } finally {
      setIsAgentLoading(false);
      
      // Refresh chat history after a small delay to ensure modal state has settled
      if (refreshChatHistoryRef.current) {
        setTimeout(() => {
          refreshChatHistoryRef.current!().catch((error: any) => {
            console.error('Error refreshing chat history:', error);
          });
        }, 250); // Small delay to let React finish state updates
      }
    }
  };

  const handleAgentConfirm = async (finalContent: string) => {
    if (!document) return;
    
    try {
      await handleContentChange(finalContent);
      setIsAgentModalOpen(false);
      setAgentDiffHtml(null);
    } catch (error) {
      console.error('Failed to apply agent changes:', error);
      // TODO: Show error toast
    }
  };

  const handleAgentClose = () => {
    setIsAgentModalOpen(false);
    setAgentDiffHtml(null);
    setIsAgentLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-destructive text-6xl font-bold">404</div>
          <h1 className="text-2xl font-semibold text-foreground">
            {error || 'Document not found'}
          </h1>
          <p className="text-muted-foreground">
            The document you're looking for doesn't exist or has been moved.
          </p>
          <Button onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (document.status === 'PROCESSING') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-semibold text-foreground">Processing Document</h2>
          <p className="text-muted-foreground max-w-md">
            Your document is being processed. This usually takes a few minutes. 
            Please check back shortly.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={fetchDocument} variant="outline">
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-destructive text-6xl">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground">Processing Error</h2>
          <p className="text-muted-foreground max-w-md">
            There was an error processing your document. Please try uploading it again.
          </p>
          <Button onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate(projectUuid ? `/project/${projectUuid}` : '/')}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground truncate max-w-md">
                {document.title}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
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
      <div className="flex-1 bg-gray-50 dark:bg-gray-900">
        <div className="mr-96 transition-all duration-300">
          <TiptapEditor
            initialContent={document.content}
            onContentChange={handleContentChange}
            editable={document.status === 'READY'}
          />
        </div>
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar 
        documentUuid={document.uuid} 
        projectUuid={projectUuid}
        onAgentRequest={handleAgentRequest} 
        onHistoryRefresh={(refreshFn) => { refreshChatHistoryRef.current = refreshFn; }}
      />

      {/* Agent Review Modal */}
      <AgentReviewModal
        isOpen={isAgentModalOpen}
        isLoading={isAgentLoading}
        diffHtml={agentDiffHtml}
        onConfirm={handleAgentConfirm}
        onClose={handleAgentClose}
      />
    </div>
  );
};

export default EditorPage; 