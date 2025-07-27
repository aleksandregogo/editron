import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderPlus } from 'lucide-react';
import { apiClient } from '../utils/api';

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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customInstructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Reset form
      setFormData({ name: '', description: '', customInstructions: '' });
      
      // Close modal
      onOpenChange?.(false);
      
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
              onClick={() => onOpenChange?.(false)}
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