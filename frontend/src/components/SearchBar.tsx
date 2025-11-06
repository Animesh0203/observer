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
}

const SearchBar = ({ searchQuery, onSearchChange, isSidebarCollapsed }: SearchBarProps) => {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
      {/* Search Input */}
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

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Filter Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Name</DropdownMenuItem>
            <DropdownMenuItem>Date Added</DropdownMenuItem>
            <DropdownMenuItem>Date Modified</DropdownMenuItem>
            <DropdownMenuItem>Size</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Images</DropdownMenuItem>
            <DropdownMenuItem>Videos</DropdownMenuItem>
            <DropdownMenuItem>All Media</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Grid3x3 className="h-4 w-4 mr-2" />
              Small Grid
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Medium Grid
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Large Grid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload Button */}
        <Button className="bg-gray-800 hover:bg-gray-700">
          <Settings/>
        </Button>
      </div>
    </div>
  );
};

export default SearchBar;