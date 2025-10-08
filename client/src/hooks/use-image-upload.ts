import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Image } from '@shared/schema';

interface UploadOptions {
  conversationId?: number;
  eventId?: number;
  analyzeWithAI?: boolean;
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<Image | null> => {
    setIsUploading(true);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('image', file);
      
      if (options.conversationId) {
        formData.append('conversationId', options.conversationId.toString());
      }
      
      if (options.eventId) {
        formData.append('eventId', options.eventId.toString());
      }
      
      if (options.analyzeWithAI) {
        formData.append('analyzeWithAI', 'true');
      }

      // Upload to server
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadedImage: Image = await response.json();

      toast({
        title: 'Image uploaded',
        description: options.analyzeWithAI 
          ? 'AI is analyzing your image...'
          : 'Image uploaded successfully',
      });

      return uploadedImage;
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImage,
    isUploading,
  };
}
