import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TiptapEditor from './TiptapEditor';
import { ChatSidebar } from './Chat/ChatSidebar';
import { apiClient } from '../utils/api';

interface Document {
  uuid: string;
  title: string;
  content: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
  updatedAt: string;
  createdAt: string;
}

const EditorPage = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (uuid) {
      fetchDocument();
    }
  }, [uuid]);

  const fetchDocument = async () => {
    try {
      const doc = await apiClient.getDocument(uuid!) as Document;
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
      await apiClient.updateDocument(document.uuid, { content });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
      // Optionally show an error message to the user
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="spinner spinner-lg mb-4"></div>
          <p className="text-secondary">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-primary mb-4">Document Error</h2>
          <p className="text-secondary mb-6">{error || 'Document not found'}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="editor-page"
      style={{ 
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        // Add right margin to account for the fixed sidebar (25vw + some padding)
        marginRight: 'calc(25vw + 48px)', // 25vw for expanded, 48px for minimized
        transition: 'margin-right var(--transition-normal)',
      }}
    >
      {/* Header */}
      <div 
        className="editor-header"
        style={{ 
          backgroundColor: 'var(--bg-elevated)', 
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 
                className="text-xl font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {document.title}
              </h1>
              {document.status !== 'READY' && (
                <span 
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    document.status === 'PROCESSING' ? 'badge-warning' : 'badge-error'
                  }`}
                >
                  {document.status}
                </span>
              )}
            </div>
            <div 
              className="flex items-center space-x-4 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <div 
                    className="spinner spinner-sm mr-2"
                    style={{
                      borderTopColor: 'var(--accent-primary)',
                    }}
                  ></div>
                  Saving...
                </span>
              ) : (
                <span>{formatLastSaved()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <TiptapEditor
          initialContent={document.content}
          onContentChange={handleContentChange}
          editable={document.status === 'READY'}
        />
      </div>

      {/* Chat Sidebar - Fixed positioned */}
      <ChatSidebar documentUuid={document.uuid} />
    </div>
  );
};

export default EditorPage; 