// components/Sidebar.tsx
import { ChevronLeft, ChevronRight, Folder, Image, Star, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import svg from "../assets/images/svg.svg";
import { SelectFolder } from "../../wailsjs/go/main/App"
import { Label } from '@radix-ui/react-label';
import { useState } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  selectedFolder: string;
  onFolderSelect: (folderId: string) => void;
}

const Sidebar = ({ isCollapsed, onToggle, selectedFolder, onFolderSelect }: SidebarProps) => {
  const menuItems = [
    { id: 'all', label: 'All Images', icon: Image, count: 0 },
    { id: 'favorites', label: 'Favorites', icon: Star, count: 0 },
    { id: 'recent', label: 'Recent', icon: Clock, count: 0 },
    { id: 'tagged', label: 'Tagged', icon: Tag, count: 0 },
  ];

  const folders = [
    { id: 'folder1', label: 'Downloads', count: 45 },
    { id: 'folder2', label: 'Screenshots', count: 23 },
    { id: 'folder3', label: 'Wallpapers', count: 67 },
  ];

  const [FolderPath, setFolderPath] = useState<string>("");
  const [FolderName, setFolderName] = useState<string>("");

  async function handleSelectFolder() {
    try {
      setFolderPath( await SelectFolder(FolderName) );
    } 
    catch (err) {
        console.error("Error Selecting Folder:", err);
    }
  }

  return (
    <div
      className={cn(
        'relative bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-100"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Logo/Title */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <img src={svg} alt="Logo" className='h-10 w-10' />
        {!isCollapsed && (
          <span className="ml-3 font-mono font-semibold text-md text-gray-800">observer</span>
        )}
      </div>

      {/* Menu Items */}
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onFolderSelect(item.id)}
                className={cn(
                  'w-full flex items-center px-3 py-2 rounded-lg transition-colors',
                  selectedFolder === item.id
                    ? 'bg-blue-50 text-gray-600'
                    : 'text-gray-900 hover:bg-gray-200',
                  isCollapsed ? 'justify-center' : 'justify-start'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="ml-3 font-medium">{item.label}</span>
                    {item.count > 0 && (
                      <span className="ml-auto text-sm text-gray-500">{item.count}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Folders Section */}
        {!isCollapsed && (
          <div className="mt-6 px-2">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Folders
            </h3>
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => onFolderSelect(folder.id)}
                  className={cn(
                    'w-full flex items-center px-3 py-2 rounded-lg transition-colors',
                    selectedFolder === folder.id
                      ? 'bg-blue-50 text-gray-600'
                    : 'text-gray-900 hover:bg-gray-200',
                  )}
                >
                  <Folder className="h-5 w-5 flex-shrink-0" />
                  <span className="ml-3 font-medium">{folder.label}</span>
                  <span className="ml-auto text-sm text-gray-500">{folder.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="mt-6 px-2 space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFolderSelect(folder.id)}
                className={cn(
                  'w-full flex items-center justify-center px-3 py-2 rounded-lg transition-colors',
                  selectedFolder === folder.id
                     ? 'bg-blue-50 text-gray-600'
                    : 'text-gray-900 hover:bg-gray-200',
                )}
                title={folder.label}
              >
                <Folder className="h-5 w-5" />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full" size="sm">
                <Folder className="h-4 w-4 mr-2" />
                Add Folder
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" alignOffset={15} sideOffset={15}>
              <Button className='w-full mb-3' onClick={handleSelectFolder}>
                Choose Folder
              </Button>
              <Input disabled type="text" className='ghost mb-3' value={FolderPath} placeholder='Folder Path' />
              <Input onChange={(e) => setFolderName(e.target.value)} placeholder="Folder name" />
              <Button variant="outline" className="w-full mt-2" size="sm">
                Create Folder
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};

export default Sidebar;