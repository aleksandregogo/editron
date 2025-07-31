import { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { apiClient } from '../../utils/api';

interface Contact {
  name: string;
  email: string;
}

interface ContactSearchProps {
  onSelectContact: (emails: string[]) => void;
  selectedEmails: string[];
  children: React.ReactNode;
}

const ContactSearch = ({ onSelectContact, selectedEmails, children }: ContactSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = (email: string) => {
    if (validateEmail(email) && !selectedEmails.includes(email)) {
      onSelectContact([...selectedEmails, email]);
      setSearchQuery('');
    }
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    
    // Auto-add valid email when user stops typing
    if (validateEmail(value) && !selectedEmails.includes(value)) {
      setTimeout(() => {
        if (searchQuery === value) { // Only add if user hasn't continued typing
          addEmail(value);
        }
      }, 1000); // Wait 1 second after user stops typing
    }
  };

  const removeEmail = (emailToRemove: string) => {
    onSelectContact(selectedEmails.filter(email => email !== emailToRemove));
  };

  const searchContacts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setContacts([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await apiClient.searchGoogleContacts(query) as Contact[];
      setContacts(results);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContacts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchContacts]);

  const handleSelectContact = (contact: Contact) => {
    addEmail(contact.email);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      addEmail(searchQuery.trim());
    }
  };

  const handleBlur = () => {
    // Add email immediately when input loses focus
    if (searchQuery.trim() && validateEmail(searchQuery.trim()) && !selectedEmails.includes(searchQuery.trim())) {
      addEmail(searchQuery.trim());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search contacts or type email..."
            value={searchQuery}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : contacts.length > 0 ? (
              <CommandGroup>
                {contacts.map((contact) => (
                  <CommandItem
                    key={contact.email}
                    onSelect={() => handleSelectContact(contact)}
                    className="flex items-center space-x-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {contact.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{contact.name}</span>
                      <span className="text-xs text-muted-foreground">{contact.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : searchQuery ? (
              <CommandEmpty>No contacts found.</CommandEmpty>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Start typing to search contacts...
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ContactSearch; 