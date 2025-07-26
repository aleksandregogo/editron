import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Check, Undo } from 'lucide-react';
import parse, { domToReact, Element, DOMNode } from 'html-react-parser';

// Data structure for a single, manageable change within the modal's state
interface Change {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface AgentReviewModalProps {
  isOpen: boolean;
  isLoading: boolean;
  diffHtml: string | null;
  onConfirm: (finalContent: string) => void;
  onClose: () => void;
}

const LoadingSkeleton: React.FC = () => (
    <div className="p-6 flex flex-col h-full">
        <DialogHeader className="pb-4 border-b">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
        </DialogHeader>
        <div className="flex-grow py-8 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-16 w-full mt-4" />
            <Skeleton className="h-4 w-full" />
        </div>
        <DialogFooter className="pt-4 border-t">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
        </DialogFooter>
    </div>
);

export const AgentReviewModal: React.FC<AgentReviewModalProps> = ({
  isOpen, isLoading, diffHtml, onConfirm, onClose
}) => {
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [history, setHistory] = useState<Record<string, Change>[]>([]);

  // This effect is the key to our declarative model.
  // It runs once to parse the raw diffHtml and populate our initial state.
  useEffect(() => {
    if (!isLoading && diffHtml) {
      const initialChanges: Record<string, Change> = {};
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = diffHtml;
      
      let changeIdCounter = 0;
      // Find all change tags (<ins> and <del>) and assign a unique, stable ID
      tempDiv.querySelectorAll('ins, del').forEach(tag => {
        // Prevent re-assigning IDs to nested tags
        if (tag.getAttribute('data-change-id')) return;

        const id = `change_${changeIdCounter++}`;
        tag.setAttribute('data-change-id', id);
        initialChanges[id] = { id, status: 'pending' };
      });
      
      setChanges(initialChanges);
      setHistory([initialChanges]); // Initialize undo history
    } else {
      // Reset state when modal is closed or loading
      setChanges({});
      setHistory([]);
    }
  }, [isLoading, diffHtml]);

  const recordHistory = (newChangeState: Record<string, Change>) => {
    setHistory(prev => [...prev, newChangeState]);
  };
  
  const undo = () => {
    if (history.length <= 1) return; // Can't undo the initial state
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    setChanges(newHistory[newHistory.length - 1]); // Revert to previous state
    setHistory(newHistory);
  };
  
  const handleDecision = useCallback((id: string, newStatus: 'accepted' | 'rejected') => {
    const newChanges = { ...changes, [id]: { ...changes[id], status: newStatus }};
    setChanges(newChanges);
    recordHistory(newChanges);
  }, [changes]);

  const handleConfirmAll = useCallback(() => {
    const newChanges: Record<string, Change> = {};
    Object.keys(changes).forEach(id => {
      newChanges[id] = { ...changes[id], status: 'accepted' };
    });
    setChanges(newChanges);
    recordHistory(newChanges);
  }, [changes]);

  const handleRejectAll = useCallback(() => {
    const newChanges: Record<string, Change> = {};
    Object.keys(changes).forEach(id => {
      newChanges[id] = { ...changes[id], status: 'rejected' };
    });
    setChanges(newChanges);
    recordHistory(newChanges);
  }, [changes]);
  
  // This function declaratively builds the final HTML based on the current state of `changes`
  const generateFinalHtml = () => {
    if (!diffHtml) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = diffHtml;

    Object.values(changes).forEach(change => {
      const element = tempDiv.querySelector(`[data-change-id="${change.id}"]`);
      if (!element) return;
      
      const isInsertion = element.tagName === 'INS';
      
      if (change.status === 'accepted') {
        // Unwrap the element, keeping its content
        element.replaceWith(...Array.from(element.childNodes));
      } else if (change.status === 'rejected') {
        // If it was an insertion, remove it. If it was a deletion, restore its content.
        isInsertion ? element.remove() : element.replaceWith(...Array.from(element.childNodes));
      }
    });

    return tempDiv.innerHTML;
  };

  const handleApply = () => {
    onConfirm(generateFinalHtml());
  };

  // The declarative renderer using html-react-parser. This is the core of the interactive UI.
  const parsedDiffContent = useMemo(() => {
    if (!diffHtml) return null;
    return parse(diffHtml, {
      replace: (domNode: DOMNode) => {
        if (domNode instanceof Element && (domNode.tagName === 'ins' || domNode.tagName === 'del')) {
          const id = domNode.attribs['data-change-id'];
          // This should never happen if the useEffect ran correctly, but it's a safe guard.
          if (!id) return; 

          const change = changes[id];
          if (!change) return; // Also a safeguard

          const isInsertion = domNode.tagName === 'ins';
          let baseClass = 'px-1 rounded-sm transition-all duration-300';
          let finalClass = '';

          switch(change.status) {
            case 'pending':
              finalClass = isInsertion ? 'bg-green-500/20' : 'bg-red-500/20';
              break;
            case 'accepted':
              finalClass = isInsertion ? 'bg-green-500/30' : 'opacity-50 line-through';
              break;
            case 'rejected':
              finalClass = isInsertion ? 'opacity-50 line-through' : 'bg-red-500/30';
              break;
          }

          return (
            <span className={`${baseClass} ${finalClass} relative group`}>
              {domToReact(domNode.children as DOMNode[])}
              {change.status === 'pending' && (
                <div className="absolute -top-8 -right-1 z-10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 rounded-md bg-background border shadow-lg">
                  <Button size="xs" variant="destructive" onClick={() => handleDecision(id, 'rejected')}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button size="xs" onClick={() => handleDecision(id, 'accepted')}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </span>
          );
        }
      },
    });
  }, [diffHtml, changes, handleDecision]);

  const pendingCount = useMemo(() => Object.values(changes).filter(c => c.status === 'pending').length, [changes]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0 shadow-2xl">
        {isLoading ? <LoadingSkeleton /> : (
          <>
            <DialogHeader className="p-4 border-b flex-shrink-0 flex flex-row justify-between items-center">
              <div>
                <DialogTitle className="text-lg">Review AI Agent's Changes</DialogTitle>
                <DialogDescription>{pendingCount > 0 ? `${pendingCount} suggestion(s) pending.` : 'All suggestions reviewed.'}</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={undo} disabled={history.length <= 1}>
                <Undo className="h-4 w-4" />
                <span className="sr-only">Undo last decision</span>
              </Button>
            </DialogHeader>
            
            <ScrollArea className="flex-grow bg-background">
              <style>{`
                ins { text-decoration: none; }
                del { text-decoration: none; }
              `}</style>
              <div className="prose dark:prose-invert max-w-none p-8">{parsedDiffContent}</div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t bg-muted/40 flex-shrink-0 justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRejectAll} disabled={pendingCount === 0}>Reject Remaining</Button>
                <Button variant="outline" onClick={handleConfirmAll} disabled={pendingCount === 0}>Accept Remaining</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleApply}>Apply Changes & Save</Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}; 