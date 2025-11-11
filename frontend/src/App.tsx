import { useEffect, useState } from 'react';
import { GetImageByFolders, GetImages, UnTaggedImages} from '../wailsjs/go/main/App';
import ImageGrid from './components/ImageGrid';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial load
useEffect(() => { fetchImages(selectedFolder) }, [selectedFolder]);

  // 🔹 Fetch images whenever selected folder changes
  useEffect(() => {
    fetchImages(selectedFolder);
  }, [selectedFolder]);

  async function fetchImages(folderId: string) {
    setLoading(true);
    try {
      let data;
      if (folderId === 'all') {
        data = await GetImages();
      } else if(folderId === 'untagged') {
        data = await UnTaggedImages();
      } 
      else {
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

  // 🔍 Filtering logic (search)
  const filteredImages = (images ?? []).filter((img) => {
    const matchesSearch =
      img?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img?.tags?.some((tag: string) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesSearch;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
  {/* Sidebar stays fixed */}
  <Sidebar
    isCollapsed={isSidebarCollapsed}
    onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
    selectedFolder={selectedFolder}
    onFolderSelect={setSelectedFolder}
  />

  {/* Main content (SearchBar + ImageGrid) */}
  <div className="flex-1 flex flex-col">
    {/* SearchBar fixed at top */}
    <div className="shrink-0">
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    </div>

    {/* Scrollable ImageGrid container */}
    <div className="flex-1 min-h-0 overflow-y-auto">
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-gray-500">
          Loading images...
        </div>
      ) : (
        <ImageGrid images={filteredImages} onImagesLoad={setImages} />
      )}
    </div>
  </div>
</div>
  );
}

export default App;
