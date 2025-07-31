import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Paperclip, Send, X } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { useToast } from '../../hooks/use-toast';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentUuid: string;
}

const ComposeEmailModal = ({ isOpen, onClose, documentTitle, documentUuid }: ComposeEmailModalProps) => {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
  };

  const handleEmailInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && emailInput.trim()) {
      e.preventDefault();
      addEmail(emailInput.trim());
    }
  };

  const handleEmailInputBlur = () => {
    if (emailInput.trim() && validateEmail(emailInput.trim())) {
      addEmail(emailInput.trim());
    }
  };

  const addEmail = (email: string) => {
    if (validateEmail(email) && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setEmailInput('');
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setRecipients(recipients.filter(email => email !== emailToRemove));
  };

  const handleSendEmail = async () => {
    if (recipients.length === 0 || !subject || !body) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.sendEmail({
        to: recipients.join(', '),
        subject,
        body,
        documentUuid,
      });

      toast({
        title: 'Email Sent',
        description: 'Your email has been sent successfully!',
      });

      // Reset form and close modal
      setRecipients([]);
      setEmailInput('');
      setSubject('');
      setBody('');
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Failed to Send Email',
        description: error instanceof Error ? error.message : 'An error occurred while sending the email.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-neutral-900">Compose Email</DialogTitle>
          <DialogDescription>
            Send an email with your document attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div className="space-y-2">
            <label htmlFor="recipients" className="text-sm font-medium text-neutral-700">
              To:
            </label>
            <Input
              id="recipients"
              type="text"
              placeholder="Enter email addresses..."
              value={emailInput}
              onChange={(e) => handleEmailInputChange(e.target.value)}
              onKeyDown={handleEmailInputKeyDown}
              onBlur={handleEmailInputBlur}
              className="input-modern"
            />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <button
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:bg-neutral-300/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium text-neutral-700">
              Subject:
            </label>
            <Input
              id="subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-modern"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Attachment:
            </label>
            <div className="flex items-center space-x-2 p-3 border border-neutral-200 rounded-lg bg-neutral-50">
              <Paperclip className="h-4 w-4 text-neutral-500" />
              <Badge variant="secondary" className="text-xs">
                {documentTitle}
              </Badge>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <label htmlFor="body" className="text-sm font-medium text-neutral-700">
              Message:
            </label>
            <Textarea
              id="body"
              placeholder="Enter your email message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input-modern min-h-[200px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="btn-secondary">
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={isLoading || recipients.length === 0 || !subject || !body} className="btn-primary">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailModal; 