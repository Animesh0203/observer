// components/SearchBar.tsx
import { Search, SlidersHorizontal, Grid3x3, LayoutGrid, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSidebarCollapsed: boolean;
  onSort: (sortBy: string) => void;
  // onResize: (size: "small" | "medium" | "large") => void;
  onRefresh?: () => void;
}

const SearchBar = ({
  searchQuery,
  onSearchChange,
  isSidebarCollapsed,
  onSort,
  // onResize,
  onRefresh
}: SearchBarProps) => {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">

      <div className="flex-1 max-w-2xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search images by name or tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4 w-full"
        />
      </div>

      <div className="flex justify-end items-center gap-2">

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => onSort("name")}>Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("dateAdded")}>Date Added</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("dateModified")}>Date Modified</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("size")}>Size</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Toggle
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onResize("small")}>
              <Grid3x3 className="h-4 w-4 mr-2" />
              Small Grid
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onResize("medium")}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Medium Grid
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onResize("large")}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Large Grid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}

        {/* Refresh */}
        <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
          <Settings className="h-4 w-4" />
        </Button>

      </div>
    </div>
  );
};

export default SearchBar;