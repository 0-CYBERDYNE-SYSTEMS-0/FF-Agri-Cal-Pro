import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, Upload, File, CheckCircle } from "lucide-react";

export interface UploadedFile {
  id: number;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  description?: string;
}

interface FileUploadProps {
  onUploadSuccess?: (file: UploadedFile) => void;
  projectId?: number;
  acceptedTypes?: string[];
  maxSizeGB?: number;
}

export default function FileUpload({ 
  onUploadSuccess, 
  projectId,
  acceptedTypes = ['.csv', '.txt', '.pdf', '.xlsx', '.json'],
  maxSizeGB = 0.1 // 100MB default
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSizeGB}GB`;
    }

    if (acceptedTypes.length > 0) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExtension)) {
        return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
      }
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      // Read file content
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      // Create file record via API
      const fileData = {
        filename: `${Date.now()}_${file.name}`,
        originalName: file.name,
        filePath: `/uploads/${Date.now()}_${file.name}`,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        mimeType: file.type,
        fileSize: file.size,
        description: `Uploaded file: ${file.name}`,
        metadata: {
          content: fileContent,
          rawContent: fileContent,
          uploadTimestamp: Date.now()
        },
        ...(projectId && { projectId })
      };

      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileData)
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadedFile = await response.json();
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedFile(uploadedFile);
      onUploadSuccess?.(uploadedFile);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload File
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragOver ? 'border-primary bg-primary/5' : 'border-gray-300'}
            ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary hover:bg-primary/5'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Uploading...</p>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">{Math.round(uploadProgress)}%</p>
              </div>
            </div>
          ) : uploadedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Upload successful!</p>
                <p className="text-xs text-gray-500">{uploadedFile.originalName}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <File className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum file size: {maxSizeGB}GB
                </p>
                {acceptedTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 justify-center">
                    {acceptedTypes.map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-600">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}