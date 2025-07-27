import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Calendar, User, Settings, MessageSquare } from 'lucide-react';
import { apiClient } from '../utils/api';

interface Project {
  uuid: string;
  name: string;
  description?: string;
  customInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  uuid: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const ProjectDashboard = () => {
  const { projectUuid } = useParams<{ projectUuid: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectUuid) {
      fetchProjectData();
    }
  }, [projectUuid]);

  const fetchProjectData = async () => {
    if (!projectUuid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch project details and documents in parallel
      const [projectData, documentsData] = await Promise.all([
        apiClient.getProject(projectUuid),
        apiClient.getDocuments(projectUuid)
      ]);
      
      setProject(projectData as Project);
      setDocuments(documentsData as Document[]);
    } catch (error) {
      console.error('Failed to fetch project data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectUuid) return;

    // Reset the input so the same file can be uploaded again if needed
    event.target.value = '';

    setIsUploading(true);
    try {
      const uploadedDocument = await apiClient.uploadDocument(file, projectUuid);
      
      // Add the new document to the list
      setDocuments(prev => [uploadedDocument, ...prev]);
      
      // Navigate to the editor for the new document
      navigate(`/project/${projectUuid}/editor/${uploadedDocument.uuid}`);
    } catch (error) {
      console.error('Upload failed:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentClick = (documentUuid: string) => {
    navigate(`/project/${projectUuid}/editor/${documentUuid}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(project.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Custom Instructions Card */}
      {project.customInstructions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              AI Instructions for this Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {project.customInstructions}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Documents</h2>
          <div>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label htmlFor="file-upload">
              <Button asChild disabled={isUploading}>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {documents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Upload your first DOCX document to get started with AI-powered editing and chat within this project.
              </p>
              <label htmlFor="file-upload">
                <Button asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Your First Document
                  </span>
                </Button>
              </label>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card
                key={doc.uuid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDocumentClick(doc.uuid)}
              >
                <CardHeader>
                  <CardTitle className="flex items-start gap-3">
                    <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </CardTitle>
                  <CardDescription>
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {doc.status.toLowerCase()}
                      </span>
                      <span className="text-xs">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 