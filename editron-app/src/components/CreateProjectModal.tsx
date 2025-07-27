import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderPlus } from 'lucide-react';
import { apiClient } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface CreateProjectModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onProjectCreated?: (project: any) => void;
  trigger?: React.ReactNode;
}

export const CreateProjectModal = ({ 
  isOpen, 
  onOpenChange, 
  onProjectCreated,
  trigger 
}: CreateProjectModalProps) => {
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
  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
    
    if (!open) {
      // Reset form when modal closes
      setFormData({ name: '', description: '', customInstructions: '' });
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
      const newProject = await apiClient.createProject({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        customInstructions: formData.customInstructions.trim() || undefined,
      });

      // Show success toast
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
      
    } catch (error) {
      console.error('Failed to create project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
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

  const defaultTrigger = (
    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
      <FolderPlus className="w-4 h-4" />
    </Button>
  );

  return (
    <Dialog 
      open={dialogOpen} 
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="Enter project name"
              value={formData.name}
              onChange={handleInputChange('name')}
              disabled={isSubmitting}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of your project (optional)"
              value={formData.description}
              onChange={handleInputChange('description')}
              disabled={isSubmitting}
              className="w-full"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions">Custom AI Instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="Provide context and instructions for AI interactions within this project (optional)"
              value={formData.customInstructions}
              onChange={handleInputChange('customInstructions')}
              disabled={isSubmitting}
              className="w-full"
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              These instructions will be used to provide context to AI responses when working within this project.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="flex-1"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 