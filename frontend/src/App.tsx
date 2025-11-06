// App.tsx
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import ImageGrid from './components/ImageGrid';
import { ImageData } from './types';
import { GetImages } from '.././wailsjs/go/main/App';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [images, setImages] = useState<ImageData[]>([]);

  useEffect(() => {
    GetImages().then(setImages);
  }, []);

  const filteredImages = images.filter(img => {
    const matchesSearch = img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = selectedFolder === 'all' || img.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        
        <ImageGrid
          images={filteredImages}
          onImagesLoad={setImages}
        />
      </div>
    </div>
  );
}

export default App;