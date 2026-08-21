import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  isValidElement,
  type ComponentType,
} from 'react';
import { Search, Command, ArrowRight } from 'lucide-react';
import { useCommandRegistry, type CommandItem } from '../../hooks/useCommandRegistry';

export interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
  commands?: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  isOpen: controlledIsOpen,
  onClose,
  commands: customCommands,
  placeholder = 'Type a command or search...',
}: CommandPaletteProps): React.JSX.Element | null {
  const registeredCommands = useCommandRegistry();
  const allCommands = customCommands || registeredCommands;

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K toggle listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isControlled) {
          if (isOpen && onClose) onClose();
        } else {
          setInternalIsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isControlled, isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isControlled) {
      if (onClose) onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const lowerQuery = query.toLowerCase().trim();
    return allCommands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(lowerQuery)) return true;
      if (cmd.description && cmd.description.toLowerCase().includes(lowerQuery)) return true;
      if (cmd.category && cmd.category.toLowerCase().includes(lowerQuery)) return true;
      if (cmd.keywords && cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)))
        return true;
      return false;
    });
  }, [allCommands, query]);

  // Reset selectedIndex when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      const cat = cmd.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const handleSelectCommand = (cmd: CommandItem) => {
    handleClose();
    cmd.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedCmd = filteredCommands[selectedIndex];
      if (selectedCmd) {
        handleSelectCommand(selectedCmd);
      }
    }
  };

  if (!isOpen) return null;

  const activeOptionId =
    filteredCommands.length > 0 && filteredCommands[selectedIndex]
      ? `command-opt-${filteredCommands[selectedIndex].id}`
      : undefined;

  let flatIndex = 0;

  const renderIcon = (icon: CommandItem['icon']) => {
    if (!icon) return <Command className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
      return React.createElement(
        icon as ComponentType<{ className?: string; 'aria-hidden'?: string | boolean }>,
        {
          className: 'h-4 w-4 text-muted-foreground',
          'aria-hidden': 'true',
        }
      );
    }
    return null;
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      {/* Live Region for Screen Readers */}
      <div aria-live="polite" className="sr-only">
        {filteredCommands.length} commands available
      </div>

      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[75vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-border bg-background flex-shrink-0">
          <Search
            className="h-4 w-4 text-muted-foreground me-2.5 flex-shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={true}
            aria-controls="command-palette-results"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-normal"
          />
          <kbd
            aria-hidden="true"
            className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border/80 rounded select-none"
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listboxRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Commands"
          className="p-2 overflow-y-auto flex-1 space-y-3"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((cmd) => {
                    const currentIndex = flatIndex;
                    flatIndex += 1;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <div
                        key={cmd.id}
                        id={`command-opt-${cmd.id}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectCommand(cmd)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`p-1.5 rounded-lg flex-shrink-0 ${
                              isSelected
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {renderIcon(cmd.icon)}
                          </div>
                          <div className="truncate">
                            <span className="truncate">{cmd.title}</span>
                            {cmd.description && (
                              <span
                                className={`ms-2 text-[11px] truncate ${
                                  isSelected
                                    ? 'text-primary-foreground/80'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {cmd.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {cmd.shortcut ? (
                          <kbd
                            aria-hidden="true"
                            className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                              isSelected
                                ? 'bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground'
                                : 'bg-muted border-border text-muted-foreground'
                            }`}
                          >
                            {cmd.shortcut}
                          </kbd>
                        ) : (
                          <ArrowRight
                            className={`h-3.5 w-3.5 ${
                              isSelected ? 'text-primary-foreground opacity-100' : 'opacity-0'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
