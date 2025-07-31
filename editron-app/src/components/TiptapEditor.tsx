import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Minus, 
  Undo, 
  Redo,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';

interface TiptapEditorProps {
  initialContent: string;
  onContentChange?: (content: string) => void;
  editable?: boolean;
}

const TiptapEditor = ({ initialContent, onContentChange, editable = true }: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-12 py-8 text-neutral-900',
      },
    },
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        onContentChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && editable !== editor.isEditable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent, false);
    }
  }, [editor, initialContent]);

  const ToolbarButton = useCallback(({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    title, 
    children 
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={isActive ? "default" : "ghost"}
      size="sm"
      className={`h-8 w-8 p-0 ${isActive ? 'bg-primary-500 text-white hover:bg-primary-600' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}
      title={title}
    >
      {children}
    </Button>
  ), []);

  if (!editor) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-600">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {editable && (
        <div className="bg-neutral-50 border-b border-neutral-200 p-3 flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                <Heading1 className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                <Heading2 className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
              >
                <Heading3 className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
              >
                <Quote className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
              >
                <Minus className="h-4 w-4" />
              </ToolbarButton>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo"
              >
                <Undo className="h-4 w-4" />
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo"
              >
                <Redo className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-auto bg-neutral-50">
        <div className="max-w-4xl mx-auto mt-8 mb-8 bg-white shadow-lg rounded-xl overflow-hidden border border-neutral-200">
          <EditorContent 
            editor={editor} 
            className="prose prose-lg prose-neutral max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[500px] [&_.ProseMirror]:px-12 [&_.ProseMirror]:py-8 [&_.ProseMirror]:text-neutral-900"
          />
        </div>
      </div>
    </div>
  );
};

export default TiptapEditor; 