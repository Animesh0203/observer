// components/ImageGrid.tsx
import { useEffect } from 'react';
import { ImageData } from '../types';
import ImageCard from './ImageCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageGridProps {
  images: ImageData[];
  onImagesLoad: (images: ImageData[]) => void;
}

const ImageGrid = ({ images }: ImageGridProps) => {

  // useEffect(() => {
  //   onImagesLoad(images);
  // }, [images, onImagesLoad]);

  return (
    <ScrollArea className="flex-1 p-6">
      {images.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No images found</h3>
            <p className="text-gray-500">Upload some images to get started</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {images.map((image) => (
            <ImageCard key={image.id} image={image} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
};

export default ImageGrid;