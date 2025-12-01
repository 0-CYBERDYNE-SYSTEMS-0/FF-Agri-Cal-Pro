import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Paperclip, Send, X, Loader2 } from 'lucide-react';
import { useImageUpload } from '@/hooks/use-image-upload';

interface MessageInputProps {
  onSendMessage: (message: string, imageUrls?: string[]) => void;
  disabled?: boolean;
  conversationId?: number;
}

export default function MessageInput({ 
  onSendMessage, 
  disabled = false,
  conversationId 
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [imagePreviews, setImagePreviews] = useState<{ file: File; preview: string; url?: string }[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useImageUpload();

  const handleImageCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const preview = URL.createObjectURL(file);
    setImagePreviews([...imagePreviews, { file, preview }]);

    // Upload image with AI analysis
    const uploadedImage = await uploadImage(file, {
      conversationId,
      analyzeWithAI: true,
    });

    if (uploadedImage) {
      // Update preview with server URL
      setImagePreviews(prev =>
        prev.map(p =>
          p.file === file ? { ...p, url: uploadedImage.url } : p
        )
      );
    }

    // Reset input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        setImagePreviews(prev => [...prev, { file, preview }]);

        const uploadedImage = await uploadImage(file, {
          conversationId,
          analyzeWithAI: true,
        });

        if (uploadedImage) {
          setImagePreviews(prev =>
            prev.map(p =>
              p.file === file ? { ...p, url: uploadedImage.url } : p
            )
          );
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() && imagePreviews.length === 0) return;
    if (isUploading) return;

    // Get uploaded image URLs
    const imageUrls = imagePreviews
      .filter(p => p.url)
      .map(p => p.url!);

    onSendMessage(input, imageUrls);

    // Clear state
    setInput('');
    imagePreviews.forEach(p => URL.revokeObjectURL(p.preview));
    setImagePreviews([]);
  };

  const isSubmitDisabled = disabled || (!input.trim() && imagePreviews.length === 0) || isUploading;

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-200 flex-shrink-0">
      {/* Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img
                src={preview.preview}
                alt={`Preview ${index + 1}`}
                className="h-20 w-20 object-cover rounded border"
              />
              {!preview.url && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white hover:bg-gray-100 p-0"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex gap-2 items-center">
        {/* Camera Button */}
        <label htmlFor="camera-input" className="cursor-pointer">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            disabled={disabled || isUploading}
            asChild
          >
            <div>
              <Camera className="h-5 w-5" />
            </div>
          </Button>
        </label>
        <input
          ref={cameraInputRef}
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageCapture}
          disabled={disabled || isUploading}
        />

        {/* File Button */}
        <label htmlFor="file-input" className="cursor-pointer">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            disabled={disabled || isUploading}
            asChild
          >
            <div>
              <Paperclip className="h-5 w-5" />
            </div>
          </Button>
        </label>
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
          disabled={disabled || isUploading}
        />

        {/* Text Input */}
        <Input
          type="text"
          placeholder={
            isUploading
              ? 'Uploading image...'
              : imagePreviews.length > 0
              ? 'Add a message (optional)...'
              : 'Ask anything or upload a photo...'
          }
          className="flex-1 rounded-full"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || isUploading}
        />

        {/* Send Button */}
        <Button
          type="submit"
          size="icon"
          className="flex-shrink-0 rounded-full"
          disabled={isSubmitDisabled}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>
  );
}
