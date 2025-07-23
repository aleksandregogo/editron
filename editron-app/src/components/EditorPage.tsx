import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TiptapEditor from './TiptapEditor';
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

    // Debounced save (in a real app, you'd want proper debouncing)
    setIsSaving(true);
    
    try {
      await apiClient.updateDocument(uuid!, { content });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatLastSaved = () => {
    if (!lastSaved) return 'Not saved';
    return `Last saved at ${lastSaved.toLocaleTimeString()}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">{document.title}</h1>
              {document.status !== 'READY' && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  document.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {document.status}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              {isSaving ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                  Saving...
                </span>
              ) : (
                <span>{formatLastSaved()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <TiptapEditor
              initialContent={document.content}
              onContentChange={handleContentChange}
              editable={document.status === 'READY'}
            />
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Chat Assistant</h3>
              <div className="text-gray-600 text-sm">
                <p className="mb-2">AI chat functionality will be implemented in the next phase.</p>
                <p>This sidebar will contain:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Document-aware AI chat</li>
                  <li>Editing suggestions</li>
                  <li>Research assistance</li>
                  <li>Content generation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage; 