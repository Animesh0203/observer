import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type * as React from "react";
import { Search, Image, Calendar, FolderOpen, X } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

// Mock photo data - replace with actual Wails backend calls
interface Photo {
  id: string;
  path: string;
  thumbnail: string;
  filename: string;
  dateTaken: string;
  size: string;
  dimensions: string;
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Mock data - replace with actual backend call
  useEffect(() => {
    // Simulate loading photos
    const mockPhotos: Photo[] = Array.from({ length: 20 }, (_, i) => ({
      id: `photo-${i}`,
      path: `/path/to/photo-${i}.jpg`,
      thumbnail: `https://picsum.photos/seed/${i}/400/300`,
      filename: `vacation_photo_${i}.jpg`,
      dateTaken: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toLocaleDateString(),
      size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
      dimensions: "4032 × 3024"
    }));
    setPhotos(mockPhotos);
  }, []);

  // Filter photos based on search
  const filteredPhotos = photos.filter(photo =>
    photo.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    photo.dateTaken.includes(searchQuery)
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredPhotos.length) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredPhotos.length - 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 4, filteredPhotos.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 4, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredPhotos[selectedIndex]) {
            openPhoto(filteredPhotos[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          if (selectedPhoto) {
            setSelectedPhoto(null);
          } else {
            setSearchQuery("");
            searchInputRef.current?.focus();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPhotos, selectedIndex, selectedPhoto]);

  // Update selected photo when index changes
  useEffect(() => {
    if (filteredPhotos[selectedIndex]) {
      // Scroll selected item into view
      const selectedElement = document.querySelector(`[data-photo-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex, filteredPhotos]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const updateSearchQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const openPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    // Call Wails backend to open photo in default app
    toast.success(`Opening ${photo.filename}`);
  };

  const openInExplorer = (photo: Photo) => {
    // Call Wails backend to open folder
    toast.success(`Opening folder for ${photo.filename}`);
  };

  return (
    <div id="App" className="h-screen w-screen overflow-hidden">
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Toaster />
        
        <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
       <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="h-4 data-[orientation=vertical]:h-4"
            />
            {/* Breadcrumb placeholder */}
            {/* <Breadcrumb> <BreadcrumbList> <BreadcrumbItem className="hidden md:block"> <BreadcrumbLink href="#"> Building Your Application </BreadcrumbLink> </BreadcrumbItem> <BreadcrumbSeparator className="hidden md:block" /> <BreadcrumbItem> <BreadcrumbPage>Data Fetching</BreadcrumbPage> </BreadcrumbItem> </BreadcrumbList> </Breadcrumb> */}
          </div>

          {/* Center Search Bar */}
          <div className="relative flex w-full max-w-md items-center">
            <Input
              type="search"
              placeholder="Search..."
              className="w-full pr-10"
            />
            <Search
              className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          {/* Optional Right Section */}
          <div className="flex items-center gap-3">
            {/* Example: <UserMenu /> or other icons */}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-2">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="bg-muted/90 aspect-video rounded-xl" />
            <div className="bg-muted/90 aspect-video rounded-xl" />
            <div className="bg-muted/90 aspect-video rounded-xl" />
          </div>
          <div className="bg-muted/90 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;