import { useEffect, useState } from 'react';
import { GetImages, GetImageByFolders, UnTaggedImages, ScanFolder } from "../wailsjs/go/main/App"
import Sidebar from './components/Sidebar';
import { useStatusBar } from './hooks/useStatus';
import SearchBar from './components/SearchBar';
import ImageGrid from './components/ImageGrid';
import BottomBar from './components/BottomBar';

export type Activity = { id: string; label: string; detail?: string; status?: 'info' | 'success' | 'error' | 'warning' | 'running' | 'idle'; progress?: number;  startAt?: number; };


function AppContent() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridSize, setGridSize] = useState("medium");
  const [sortBy, setSortBy] = useState("name");
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { start, update, finish } = useStatusBar();

  // ✅ NOW it's legal to call the hook
  const { activities, clear } = useStatusBar();

  useEffect(() => {
    fetchImages(selectedFolder);
  }, [selectedFolder]);

  async function fetchImages(folderId: string) {
    setLoading(true);
    try {
      let data;

      if (folderId === 'all') {
        data = await GetImages();
      } else if (folderId === 'untagged') {
        data = await UnTaggedImages();
      } else {
        data = await GetImageByFolders([folderId]);
      }

      setImages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching images:", err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredImages = images.filter((img) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      img?.name?.toLowerCase().includes(query) ||
      img?.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  });

  const handleSort = (criteria: string) => {
    setSortBy(criteria);
    const sortedImages = [...filteredImages].sort((a, b) => {
      if (criteria === 'name') return a.name.localeCompare(b.name);
      if (criteria === 'dateAdded') return new Date(b.created).getTime() - new Date(a.created).getTime();
      if (criteria === 'dateModified') return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      if (criteria === 'size') return b.size - a.size;
      return 0;
    });
    setImages(sortedImages);
  };

  const handleRefresh = () => {
    start({ id: "Refreshing All Folders", label: `Refreshing All Folders` });
    ScanFolder();
    fetchImages(selectedFolder);
    finish("Refreshing All Folders", true);
  }

  // const handleResize = (size: "small" | "medium" | "large") => {
  //   setGridSize(size);
  // };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
      />

      <div className="flex-1 flex flex-col">
        <div className="shrink-0">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSidebarCollapsed={isSidebarCollapsed}
            onSort={handleSort}
            onRefresh={handleRefresh}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-gray-500">
              Loading images...
            </div>
          ) : (
            <ImageGrid images={filteredImages} />
          )}
        </div>

        {/* 🔹 Bottom status bar */}
        <BottomBar
          activities={activities}
          onOpenLogs={() => {}}
          onClear={clear}
        />
      </div>
    </div>
  );
}

export default AppContent;