import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Check, Undo } from 'lucide-react';
import parse, { domToReact, Element, DOMNode } from 'html-react-parser';

// Data structure for a single, manageable suggestion within the modal's state
interface Suggestion {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  type: 'replacement' | 'insertion' | 'deletion';
  deletionId?: string; // For tracking paired del/ins
  insertionId?: string; // For tracking paired del/ins
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
            <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">AI is analyzing your document...</p>
                <p className="text-sm text-muted-foreground mt-2">This may take a few moments</p>
            </div>
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
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [history, setHistory] = useState<Record<string, Suggestion>[]>([]);
  const [processedDiffHtml, setProcessedDiffHtml] = useState<string>('');

  // This effect is the key to our declarative model.
  // It runs once to parse the raw diffHtml and populate our initial state.
  useEffect(() => {
    if (!isLoading && diffHtml) {
      const initialSuggestions: Record<string, Suggestion> = {};
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = diffHtml;
      
      let suggestionIdCounter = 0;
      const tags = tempDiv.querySelectorAll('ins, del');
      
      // Group adjacent del/ins pairs as single suggestions
      const tagList = Array.from(tags);
      const processedTags = new Set<HTMLElement>();
      
      tagList.forEach(tag => {
        const htmlTag = tag as HTMLElement;
        if (processedTags.has(htmlTag)) return;
        
        const suggestionId = `suggestion_${suggestionIdCounter++}`;
        
        if (tag.tagName === 'DEL') {
          // Check if next sibling is an INS tag (replacement)
          const nextSibling = tag.nextElementSibling as HTMLElement;
          if (nextSibling && nextSibling.tagName === 'INS' && !processedTags.has(nextSibling)) {
            // This is a replacement (del + ins)
            htmlTag.setAttribute('data-suggestion-id', suggestionId);
            nextSibling.setAttribute('data-suggestion-id', suggestionId);
            initialSuggestions[suggestionId] = { 
              id: suggestionId, 
              status: 'pending',
              type: 'replacement',
              deletionId: suggestionId + '_del',
              insertionId: suggestionId + '_ins'
            };
            processedTags.add(htmlTag);
            processedTags.add(nextSibling);
          } else {
            // Pure deletion
            htmlTag.setAttribute('data-suggestion-id', suggestionId);
            initialSuggestions[suggestionId] = { 
              id: suggestionId, 
              status: 'pending',
              type: 'deletion'
            };
            processedTags.add(htmlTag);
          }
        } else if (tag.tagName === 'INS') {
          // Pure insertion (not preceded by DEL)
          htmlTag.setAttribute('data-suggestion-id', suggestionId);
          initialSuggestions[suggestionId] = { 
            id: suggestionId, 
            status: 'pending',
            type: 'insertion'
          };
          processedTags.add(htmlTag);
        }
      });
      
      const processedHtml = tempDiv.innerHTML;
      
      setSuggestions(initialSuggestions);
      setHistory([initialSuggestions]); // Initialize undo history
      setProcessedDiffHtml(processedHtml); // Store the processed HTML
    } else {
      // Reset state when modal is closed or loading
      setSuggestions({});
      setHistory([]);
      setProcessedDiffHtml('');
    }
  }, [isLoading, diffHtml]);

  const recordHistory = (newSuggestionState: Record<string, Suggestion>) => {
    setHistory(prev => [...prev, newSuggestionState]);
  };
  
  const undo = () => {
    if (history.length <= 1) return; // Can't undo the initial state
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    setSuggestions(newHistory[newHistory.length - 1]); // Revert to previous state
    setHistory(newHistory);
  };
  
  const handleDecision = useCallback((id: string, newStatus: 'accepted' | 'rejected') => {
    const newSuggestions = { ...suggestions, [id]: { ...suggestions[id], status: newStatus }};
    setSuggestions(newSuggestions);
    recordHistory(newSuggestions);
  }, [suggestions]);

  const handleConfirmAll = useCallback(() => {
    const newSuggestions: Record<string, Suggestion> = {};
    Object.keys(suggestions).forEach(id => {
      newSuggestions[id] = { ...suggestions[id], status: 'accepted' };
    });
    setSuggestions(newSuggestions);
    recordHistory(newSuggestions);
  }, [suggestions]);

  const handleRejectAll = useCallback(() => {
    const newSuggestions: Record<string, Suggestion> = {};
    Object.keys(suggestions).forEach(id => {
      newSuggestions[id] = { ...suggestions[id], status: 'rejected' };
    });
    setSuggestions(newSuggestions);
    recordHistory(newSuggestions);
  }, [suggestions]);
  
  // This function declaratively builds the final HTML based on the current state of suggestions
  const generateFinalHtml = () => {
    if (!processedDiffHtml) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedDiffHtml;

    Object.values(suggestions).forEach(suggestion => {
      if (suggestion.type === 'replacement') {
        const delElement = tempDiv.querySelector(`del[data-suggestion-id="${suggestion.id}"]`);
        const insElement = tempDiv.querySelector(`ins[data-suggestion-id="${suggestion.id}"]`);
        
        if (suggestion.status === 'accepted') {
          // Remove deletion, keep insertion content
          if (delElement) delElement.remove();
          if (insElement) insElement.replaceWith(...Array.from(insElement.childNodes));
        } else if (suggestion.status === 'rejected') {
          // Keep deletion content, remove insertion
          if (delElement) delElement.replaceWith(...Array.from(delElement.childNodes));
          if (insElement) insElement.remove();
        }
      } else {
        // Handle single ins or del
        const element = tempDiv.querySelector(`[data-suggestion-id="${suggestion.id}"]`);
        if (!element) return;
        
        const isInsertion = element.tagName === 'INS';
        
        if (suggestion.status === 'accepted') {
          // Unwrap the element, keeping its content
          element.replaceWith(...Array.from(element.childNodes));
        } else if (suggestion.status === 'rejected') {
          // If it was an insertion, remove it. If it was a deletion, restore its content.
          isInsertion ? element.remove() : element.replaceWith(...Array.from(element.childNodes));
        }
      }
    });

    return tempDiv.innerHTML;
  };

  const handleApply = () => {
    onConfirm(generateFinalHtml());
  };

  // The declarative renderer using html-react-parser. This is the core of the interactive UI.
  const parsedDiffContent = useMemo(() => {
    if (!processedDiffHtml) {
      return <div className="text-center py-8 text-muted-foreground">No content to display</div>;
    }
    
    // If there are no suggestions, just display the original content
    if (Object.keys(suggestions).length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: processedDiffHtml }} />;
    }
    
    return parse(processedDiffHtml, {
      replace: (domNode: DOMNode) => {
        if (domNode instanceof Element && (domNode.tagName === 'ins' || domNode.tagName === 'del')) {
          const suggestionId = domNode.attribs['data-suggestion-id'];
          if (!suggestionId) return; 

          const suggestion = suggestions[suggestionId];
          if (!suggestion) return;

          const isInsertion = domNode.tagName === 'ins';
          let baseClass = 'px-1 py-0.5 rounded-sm transition-all duration-300 cursor-pointer border';
          let finalClass = '';

          switch(suggestion.status) {
            case 'pending':
              finalClass = isInsertion 
                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 line-through';
              break;
            case 'accepted':
              finalClass = isInsertion 
                ? 'bg-green-200 dark:bg-green-800/40 border-green-400 dark:border-green-600 text-green-900 dark:text-green-100' 
                : 'opacity-30 line-through';
              break;
            case 'rejected':
              finalClass = isInsertion 
                ? 'opacity-30 line-through' 
                : 'bg-red-200 dark:bg-red-800/40 border-red-400 dark:border-red-600 text-red-900 dark:text-red-100';
              break;
          }

          // Show tooltip only on the new version (insertion) for replacements, or on single changes
          const showTooltip = suggestion.status === 'pending' && 
            (suggestion.type !== 'replacement' || isInsertion);

          return (
            <span className={`${baseClass} ${finalClass} relative group`}>
              {domToReact(domNode.children as DOMNode[])}
              {showTooltip && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 z-20 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 rounded-md bg-white dark:bg-gray-800 border shadow-lg">
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecision(suggestionId, 'rejected');
                    }}
                    title="Reject this suggestion"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecision(suggestionId, 'accepted');
                    }}
                    title="Accept this suggestion"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </span>
          );
        }
      },
    });
  }, [processedDiffHtml, suggestions, handleDecision, Object.keys(suggestions).length]);

  const pendingCount = useMemo(() => Object.values(suggestions).filter(s => s.status === 'pending').length, [suggestions]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTitle hidden></DialogTitle>
      <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0 shadow-2xl">
        {isLoading ? <LoadingSkeleton /> : (
          <>
            <DialogHeader className="p-4 border-b flex-shrink-0 flex flex-row justify-between items-center">
              <div>
                <DialogTitle className="text-lg">Review AI Agent's Changes</DialogTitle>
                <DialogDescription>
                  {Object.keys(suggestions).length === 0 
                    ? 'No changes suggested by the AI agent.' 
                    : pendingCount > 0 
                      ? `${pendingCount} suggestion(s) pending.` 
                      : 'All suggestions reviewed.'
                  }
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={undo} disabled={history.length <= 1}>
                <Undo className="h-4 w-4" />
                <span className="sr-only">Undo last decision</span>
              </Button>
            </DialogHeader>
            
            <ScrollArea className="flex-grow bg-background">
              <style>{`
                ins { text-decoration: none !important; }
                del { text-decoration: none !important; }
                .diff-content p { margin-bottom: 1rem; }
                .diff-content h1, .diff-content h2, .diff-content h3, .diff-content h4, .diff-content h5, .diff-content h6 { 
                  margin-top: 1.5rem; 
                  margin-bottom: 0.75rem; 
                  font-weight: 600; 
                }
                .diff-content ul, .diff-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
                .diff-content li { margin-bottom: 0.25rem; }
                .diff-content strong, .diff-content b { font-weight: 600; }
                .diff-content em, .diff-content i { font-style: italic; }
              `}</style>
              <div className="diff-content prose dark:prose-invert max-w-none p-8 bg-white dark:bg-gray-900 min-h-full">
                <div className="max-w-4xl mx-auto leading-relaxed text-base">
                  {parsedDiffContent}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t bg-muted/40 flex-shrink-0 justify-between">
              {Object.keys(suggestions).length > 0 ? (
                <>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRejectAll} disabled={pendingCount === 0}>Reject Remaining</Button>
                    <Button variant="outline" onClick={handleConfirmAll} disabled={pendingCount === 0}>Accept Remaining</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleApply}>Apply Changes & Save</Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2 ml-auto">
                  <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}; 