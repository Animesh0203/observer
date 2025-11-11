export interface ImageData {
  id: string;
  name: string;
  path: string;
  thumbnailPath?: string;
  folder: string;
  size: number;
  created: Date;
  modified: Date;
  tags?: string[];
  width?: number;
  height?: number;
}

export interface FolderData {
  id: string;
  name: string;
  path: string;
  imageCount: number;
  icon?: string;
}