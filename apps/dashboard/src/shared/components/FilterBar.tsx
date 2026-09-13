import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@heroui/react';
import { useTranslation } from '../i18n/index';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  actions,
}: FilterBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-1">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        {onSearchChange !== undefined && (
          <div className="w-full sm:w-72">
            <Input
              size="sm"
              variant="bordered"
              placeholder={searchPlaceholder || t('common.search')}
              value={search ?? ''}
              onValueChange={onSearchChange}
              startContent={<Search className="h-4 w-4 text-muted-foreground" />}
              isClearable
              onClear={() => onSearchChange('')}
              aria-label={searchPlaceholder || t('common.search')}
            />
          </div>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
