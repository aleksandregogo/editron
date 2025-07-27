import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeleteConfirmationDialogProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  itemName?: string;
}

export const DeleteConfirmationDialog = ({
  isOpen,
  onOpenChange,
  onConfirm,
  trigger,
  title = 'Confirm Deletion',
  description = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  itemName
}: DeleteConfirmationDialogProps) => {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isControlled = isOpen !== undefined;
  const dialogOpen = isControlled ? isOpen : internalOpen;

  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      handleOpenChange(false);
      toast({
        title: "Deleted successfully!",
        description: itemName ? `"${itemName}" has been deleted.` : "Item has been deleted.",
      });
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getDefaultTrigger = () => (
    <Button variant="outline" size="sm">
      <Trash2 className="w-4 h-4 mr-2" />
      Delete
    </Button>
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || getDefaultTrigger()}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isDeleting}
              className="flex-1"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? 'Deleting...' : confirmText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 