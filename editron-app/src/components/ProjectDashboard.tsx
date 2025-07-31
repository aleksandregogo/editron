import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Calendar, MessageSquare, MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { apiClient } from '../utils/api';
import { ProjectModal } from './CreateProjectModal';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

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

export const ProjectDashboard = ({ refreshProjects }: { refreshProjects?: () => void }) => {
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to load project';
      setError(errorMessage);
      
      // If it's a 404 error, the project might not exist
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        // Navigate to root to let the app handle project selection
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
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

  const handleProjectUpdate = (updatedProject: any) => {
    setProject(updatedProject);
    // Refresh the sidebar to reflect the updated project name
    if (refreshProjects) {
      refreshProjects();
    }
  };

  const handleProjectDelete = async () => {
    if (!projectUuid) return;
    
    try {
      await apiClient.deleteProject(projectUuid);
      
      // Refresh projects to get updated list
      if (refreshProjects) {
        await refreshProjects();
      }
      
      // Check if there are any projects left after deletion
      const remainingProjects = await apiClient.getProjects();
      
      if (Array.isArray(remainingProjects) && remainingProjects.length === 0) {
        // No projects left - navigate to root and show creation dialog
        navigate('/', { replace: true });
      } else if (Array.isArray(remainingProjects) && remainingProjects.length > 0) {
        // Navigate to the first available project
        const firstRemainingProject = remainingProjects[0];
        if (firstRemainingProject && firstRemainingProject.uuid) {
          navigate(`/project/${firstRemainingProject.uuid}`, { replace: true });
        } else {
          // Fallback - navigate to root
          navigate('/', { replace: true });
        }
      } else {
        // Fallback - navigate to root
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const handleDocumentDelete = async (documentUuid: string) => {
    if (!projectUuid) return;
    
    try {
      await apiClient.deleteDocument(documentUuid, projectUuid);
      // Remove the document from the local state
      setDocuments(prev => prev.filter(doc => doc.uuid !== documentUuid));
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
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
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading project...</p>
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
    <div className="flex-1 flex flex-col p-6 space-y-6 h-full overflow-y-auto bg-neutral-50">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{project.name}</h1>
          {project.description && (
            <p className="text-neutral-600 mt-2 max-w-2xl">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-neutral-500">
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
          <ProjectModal
            mode="edit"
            project={project}
            onProjectUpdated={handleProjectUpdate}
          />
          <DeleteConfirmationDialog
            title="Delete Project"
            description={`Are you sure you want to delete "${project.name}"? This will permanently delete the project and all its documents, including files from cloud storage. This action cannot be undone.`}
            confirmText="Delete Project"
            onConfirm={handleProjectDelete}
            itemName={project.name}
          />
        </div>
      </div>

      {/* Custom Instructions Card */}
      {project.customInstructions && (
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-neutral-900">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              AI Instructions for this Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 whitespace-pre-wrap">
              {project.customInstructions}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Documents</h2>
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
              <Button asChild disabled={isUploading} className="btn-primary">
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {documents.length === 0 ? (
          <Card className="card-modern">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-neutral-400 mb-4" />
              <h3 className="text-lg font-medium mb-2 text-neutral-900">No documents yet</h3>
              <p className="text-neutral-600 text-center mb-6 max-w-md">
                Upload your first DOCX document to get started with AI-powered editing and chat within this project.
              </p>
              <label htmlFor="file-upload">
                <Button asChild className="btn-primary">
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
                className="card-modern group cursor-pointer"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle 
                      className="flex items-start gap-3 flex-1 text-neutral-900"
                      onClick={() => handleDocumentClick(doc.uuid)}
                    >
                      <FileText className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary-500" />
                      <span className="truncate">{doc.title}</span>
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleDocumentClick(doc.uuid);
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-red-600 focus:text-red-600 cursor-pointer"
                        >
                          <DeleteConfirmationDialog
                            title="Delete Document"
                            description={`Are you sure you want to delete "${doc.title}"? This will permanently delete the document and all its associated data, including files from cloud storage. This action cannot be undone.`}
                            confirmText="Delete Document"
                            onConfirm={() => handleDocumentDelete(doc.uuid)}
                            itemName={doc.title}
                            trigger={
                              <div className="flex items-center w-full">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </div>
                            }
                          />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription>
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-600 font-medium">
                        {doc.status.toLowerCase()}
                      </span>
                      <span className="text-xs text-neutral-500">
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