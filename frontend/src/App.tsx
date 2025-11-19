import { useEffect, useState } from 'react';
import { GetImageByFolders, GetImages, UnTaggedImages } from '../wailsjs/go/main/App';
import ImageGrid from './components/ImageGrid';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridSize, setGridSize] = useState("medium");
  const [sortBy, setSortBy] = useState("name");
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch images whenever selected folder changes
  useEffect(() => {
    fetchImages(selectedFolder);
  }, [selectedFolder]);

  // 🚀 Clean & correct fetchImages function
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

  // 🔍 Search filter logic
  const filteredImages = images.filter((img) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    const nameMatch = img?.name?.toLowerCase().includes(query);
    const tagMatch = img?.tags?.some((tag: string) =>
      tag.toLowerCase().includes(query)
    );

    return nameMatch || tagMatch;
  });

  const handleSort = (criteria: string) => {
    setSortBy(criteria);
    const sortedImages = [...filteredImages].sort((a, b) => {
      if (criteria === 'name') {
        return a.name.localeCompare(b.name);
      } else if (criteria === 'dateAdded') {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      } else if (criteria === 'dateModified') {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      } else if (criteria === 'size') {
        return b.size - a.size;
      }
      return 0;
    });
    setImages(sortedImages);
  };

  const handleResize = (size: "small" | "medium" | "large") => {
    setGridSize(size);
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar (unchanged UI) */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        selectedFolder={selectedFolder}
        onFolderSelect={setSelectedFolder}
      />

      {/* Main section (unchanged UI) */}
      <div className="flex-1 flex flex-col">

        {/* SearchBar (unchanged) */}
        <div className="shrink-0">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSidebarCollapsed={isSidebarCollapsed}
            onSort={handleSort}
            onResize={handleResize}
          />
        </div>

        {/* Scrollable grid container (unchanged) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-gray-500">
              Loading images...
            </div>
          ) : (
            <ImageGrid
              images={filteredImages}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
