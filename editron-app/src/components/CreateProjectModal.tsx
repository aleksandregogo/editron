import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderPlus, Edit } from 'lucide-react';
import { apiClient } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface Project {
  uuid: string;
  name: string;
  description?: string;
  customInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onProjectCreated?: (project: Project) => void;
  onProjectUpdated?: (project: Project) => void;
  trigger?: React.ReactNode;
  mode?: 'create' | 'edit';
  project?: Project;
}

export const ProjectModal = ({ 
  isOpen, 
  onOpenChange, 
  onProjectCreated,
  onProjectUpdated,
  trigger,
  mode = 'create',
  project
}: ProjectModalProps) => {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customInstructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use controlled or uncontrolled state
  const isControlled = isOpen !== undefined;
  const dialogOpen = isControlled ? isOpen : internalOpen;
  
  // Initialize form data when project changes (for edit mode)
  useEffect(() => {
    if (project && mode === 'edit') {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        customInstructions: project.customInstructions || ''
      });
    }
  }, [project, mode]);

  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
    
    if (!open) {
      // Reset form when modal closes
      if (mode === 'create') {
        setFormData({ name: '', description: '', customInstructions: '' });
      }
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        const newProject = await apiClient.createProject({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          customInstructions: formData.customInstructions.trim() || undefined,
        }) as Project;

        toast({
          title: "Project created successfully!",
          description: `"${formData.name.trim()}" has been created.`,
        });
        
        // Reset form and close modal immediately
        setFormData({ name: '', description: '', customInstructions: '' });
        setError(null);
        handleOpenChange(false);
        
        // Notify parent component
        onProjectCreated?.(newProject);
      } else {
        // Edit mode
        if (!project?.uuid) {
          throw new Error('Project UUID is required for editing');
        }

        const updatedProject = await apiClient.updateProject(project.uuid, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          customInstructions: formData.customInstructions.trim() || undefined,
        }) as Project;

        toast({
          title: "Project updated successfully!",
          description: `"${formData.name.trim()}" has been updated.`,
        });
        
        setError(null);
        handleOpenChange(false);
        
        // Notify parent component
        onProjectUpdated?.(updatedProject);
      }
      
    } catch (error) {
      console.error(`Failed to ${mode} project:`, error);
      setError(error instanceof Error ? error.message : `Failed to ${mode} project`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError(null);
  };

  const getDefaultTrigger = () => {
    if (mode === 'edit') {
      return (
        <Button variant="outline" size="sm" className="btn-secondary">
          <Edit className="w-4 h-4 mr-2" />
          Modify
        </Button>
      );
    }
    return (
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100">
        <FolderPlus className="w-4 h-4" />
      </Button>
    );
  };

  const getTitle = () => mode === 'create' ? 'Create New Project' : 'Edit Project';
  const getSubmitText = () => isSubmitting ? (mode === 'create' ? 'Creating...' : 'Updating...') : (mode === 'create' ? 'Create Project' : 'Update Project');

  return (
    <Dialog 
      open={dialogOpen} 
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        {trigger || getDefaultTrigger()}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-neutral-900">{getTitle()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-neutral-700 font-medium">Project Name *</Label>
            <Input
              id="name"
              placeholder="Enter project name"
              value={formData.name}
              onChange={handleInputChange('name')}
              disabled={isSubmitting}
              className="input-modern w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-neutral-700 font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of your project (optional)"
              value={formData.description}
              onChange={handleInputChange('description')}
              disabled={isSubmitting}
              className="input-modern w-full"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions" className="text-neutral-700 font-medium">Custom AI Instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="Provide context and instructions for AI interactions within this project (optional)"
              value={formData.customInstructions}
              onChange={handleInputChange('customInstructions')}
              disabled={isSubmitting}
              className="input-modern w-full"
              rows={4}
            />
            <p className="text-sm text-neutral-500">
              These instructions will be used to provide context to AI responses when working within this project.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="btn-secondary flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="btn-primary flex-1"
            >
              {getSubmitText()}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Export the old name for backward compatibility
export const CreateProjectModal = ProjectModal; 