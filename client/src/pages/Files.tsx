import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Archive, HardDrive } from "lucide-react";
import FileManager from "@/components/files/FileManager";
import { UserFile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

export default function Files() {
  const [activeTab, setActiveTab] = useState("all");
  const { user } = useAuth();

  const { data: files = [], isLoading } = useQuery<UserFile[]>({
    queryKey: ["/api/files"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/files");
      return response.json();
    },
    enabled: !!user,
  });

  const totalFiles = files.length;
  const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
  const recentUploads = files.filter(f => {
    const uploadDate = new Date(f.uploadDate);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return uploadDate >= weekAgo;
  }).length;
  const dataFiles = files.filter(f => 
    ["csv", "json", "xlsx"].includes(f.fileType?.toLowerCase())
  ).length;

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File Management</h1>
          <p className="text-gray-600 mt-2">
            Upload, organize, and manage your agricultural data files
          </p>
        </div>
      </div>

      {/* File Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? "--" : totalFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Upload className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Uploads</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? "--" : recentUploads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Archive className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Data Files</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? "--" : dataFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Storage Used</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? "--" : formatSize(totalSize)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* File Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Files</TabsTrigger>
          <TabsTrigger value="data">Data Files</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <FileManager showUpload={true} />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agricultural Data Files</CardTitle>
              <p className="text-sm text-gray-600">
                CSV files, spreadsheets, and structured data for analysis
              </p>
            </CardHeader>
            <CardContent>
              <FileManager showUpload={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents & Reports</CardTitle>
              <p className="text-sm text-gray-600">
                Text documents, reports, and documentation files
              </p>
            </CardHeader>
            <CardContent>
              <FileManager showUpload={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Archived Files</CardTitle>
              <p className="text-sm text-gray-600">
                Older files and compressed archives for long-term storage
              </p>
            </CardHeader>
            <CardContent>
              <FileManager showUpload={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <FileText className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900">File Management Tips</h3>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Upload CSV files with farm data for AI analysis and recommendations</li>
                <li>• Supported formats: CSV, TXT, PDF, XLSX, JSON (max 100MB)</li>
                <li>• Files are automatically analyzed by the AI assistant for insights</li>
                <li>• Use descriptive filenames to help organize your agricultural data</li>
                <li>• The AI can read and analyze your uploaded files to provide farming recommendations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
