import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onDebounce?: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  shortcutKey?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value: controlledValue,
    defaultValue = '',
    onChange,
    onDebounce,
    debounceMs = 300,
    placeholder = 'Search...',
    shortcutKey,
    className = '',
    inputClassName = '',
    disabled = false,
    autoFocus = false,
    'aria-label': ariaLabel = 'Search',
  },
  ref
) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    isControlled ? controlledValue : defaultValue
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  const debouncedValue = useDebouncedValue(internalValue, debounceMs);

  useEffect(() => {
    if (onDebounce) {
      onDebounce(debouncedValue);
    }
  }, [debouncedValue, onDebounce]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('');
    }
    if (onChange) {
      onChange('');
    }
    if (onDebounce) {
      onDebounce('');
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && internalValue) {
      e.stopPropagation();
      handleClear();
    }
  };

  return (
    <div
      className={`relative flex items-center w-full rounded-lg border border-border bg-background transition-colors hover:border-foreground/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
        disabled ? 'opacity-60 cursor-not-allowed bg-muted/30' : ''
      } ${className}`}
    >
      <div className="ps-3 pe-1.5 flex items-center text-muted-foreground select-none pointer-events-none">
        <Search className="h-4 w-4" aria-hidden="true" />
      </div>

      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={internalValue}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`w-full h-9 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-normal ${inputClassName}`}
      />

      {internalValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="p-1 me-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {shortcutKey && !internalValue && (
        <div className="pe-2.5 ps-1 flex items-center">
          <kbd
            aria-hidden="true"
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border/80 rounded"
          >
            {shortcutKey}
          </kbd>
        </div>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
