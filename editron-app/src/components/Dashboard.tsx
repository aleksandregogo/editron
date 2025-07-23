import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatSidebar } from './Chat/ChatSidebar';
import { apiClient } from '../utils/api';

interface Document {
  uuid: string;
  title: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
  updatedAt: string;
  createdAt: string;
}

const Dashboard = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const docs = await apiClient.getDocuments() as Document[];
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('Please select a DOCX file');
      return;
    }

    setIsUploading(true);

    try {
      const newDoc = await apiClient.uploadDocument(file) as Document;
      setIsUploading(false);
      navigate(`/editor/${newDoc.uuid}`);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
      setIsUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: Document['status']) => {
    const statusStyles = {
      PROCESSING: 'badge badge-warning',
      READY: 'badge badge-success',
      ERROR: 'badge badge-error'
    };

    return (
      <span className={statusStyles[status]}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '16rem' }}>
        <div className="text-center">
          <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-4)' }}></div>
          <p className="text-secondary">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="dashboard-page"
      style={{ 
        maxWidth: 'var(--max-content-width)', 
        margin: '0 auto', 
        padding: 'var(--space-6) var(--space-4)',
        // Add right margin to account for the fixed sidebar
        marginRight: 'calc(25vw + 48px + var(--space-4))', // 25vw for expanded, 48px for minimized, plus original padding
        transition: 'margin-right var(--transition-normal)',
      }}
    >
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">My Documents</h2>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".docx"
            className="file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-primary"
          >
            {isUploading ? 'Uploading...' : 'Add New Document'}
          </button>
        </div>
        
        <div className="card-content">
          {documents.length === 0 ? (
            <div className="text-center" style={{ padding: 'var(--space-12) 0' }}>
              <div className="text-tertiary" style={{ marginBottom: 'var(--space-4)' }}>
                <svg style={{ margin: '0 auto', height: '3rem', width: '3rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-primary" style={{ marginBottom: 'var(--space-2)' }}>No documents yet</h3>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>Upload your first DOCX file to get started</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
              >
                Upload Document
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.uuid}>
                      <td>
                        <div className="text-sm font-medium text-primary">{doc.title}</div>
                      </td>
                      <td>
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="text-sm text-secondary">
                        {formatDate(doc.updatedAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => navigate(`/editor/${doc.uuid}`)}
                          disabled={doc.status !== 'READY'}
                          className="btn btn-ghost btn-sm"
                          style={{ opacity: doc.status !== 'READY' ? 0.5 : 1 }}
                        >
                          {doc.status === 'READY' ? 'Edit' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar - Fixed positioned (without document UUID for general mode) */}
      <ChatSidebar />
    </div>
  );
};

export default Dashboard; 