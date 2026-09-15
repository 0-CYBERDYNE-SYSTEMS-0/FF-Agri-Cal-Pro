import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project, Event } from "@shared/schema";
import { useState } from "react";
import ProjectCard from "@/components/project/ProjectCard";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/calendarUtils";
import { PROJECT_COLORS } from "@/lib/colorUtils";
import { useAuth } from "@/contexts/AuthContext";

export default function Projects() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState("default");
  const [customColor, setCustomColor] = useState("#6366f1"); // Default indigo color
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });
  
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const url = isEditing && selectedProject 
        ? `/api/projects/${selectedProject.id}` 
        : "/api/projects";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await apiRequest(method, url, projectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: isEditing ? "Project updated" : "Project created",
        description: isEditing 
          ? "Your project has been updated successfully."
          : "Your project has been created successfully."
      });
      setIsCreateModalOpen(false);
      resetForm();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isEditing 
          ? "There was a problem updating your project."
          : "There was a problem creating your project.",
        variant: "destructive"
      });
      console.error(isEditing ? "Error updating project:" : "Error creating project:", error);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully."
      });
      setIsViewModalOpen(false);
      setSelectedProject(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem deleting the project.",
        variant: "destructive"
      });
      console.error("Error deleting project:", error);
    }
  });
  
  const { data: projectEvents = [], isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ["/api/events", "project", user?.id, selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return [];
      const response = await apiRequest("GET", `/api/events?projectId=${selectedProject.id}`);
      return response.json();
    },
    enabled: !!user && !!selectedProject
  });
  
  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("planning");
    setStartDate("");
    setEndDate("");
    setColor("default");
    setCustomColor("#6366f1");
    setShowColorPicker(false);
    setIsEditing(false);
    setSelectedProject(null);
  };
  
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: "Missing Information",
        description: "Please provide a name for your project.",
        variant: "destructive"
      });
      return;
    }
    
    const projectData = {
      name,
      description,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      progress: isEditing && selectedProject ? selectedProject.progress : 0,
      color: color === "custom" ? customColor : (color === "default" ? null : color)
    };
    
    createProjectMutation.mutate(projectData);
  };
  
  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setIsViewModalOpen(true);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600";
      case "planning":
        return "text-blue-600";
      case "completed":
        return "text-purple-600";
      case "ongoing":
        return "text-yellow-600";
      default:
        return "text-neutral-600";
    }
  };
  
  // Color picker options
  const colorOptions = [
    { value: "default", label: "Default (Auto)" },
    { value: "#10b981", label: "Green" },
    { value: "#6366f1", label: "Indigo" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#ef4444", label: "Red" },
    { value: "#0ea5e9", label: "Blue" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#f43f5e", label: "Rose" },
    { value: "#0d9488", label: "Teal" },
    { value: "custom", label: "Custom Color" }
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Projects</h1>
        <Button 
          onClick={() => {
            resetForm();
            setIsEditing(false);
            setIsCreateModalOpen(true);
          }}
          className="bg-primary hover:bg-primary-dark"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Project
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoadingProjects ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-4 h-40 animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-200 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-neutral-200 rounded w-5/6 mb-4"></div>
              <div className="h-2 bg-neutral-200 rounded w-full mt-6"></div>
            </div>
          ))
        ) : projects.length > 0 ? (
          projects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onSelect={() => handleProjectSelect(project)}
            />
          ))
        ) : (
          <div className="col-span-3 text-center py-8 bg-white rounded-lg shadow">
            <p className="text-neutral-500">No projects found. Create a new project to get started.</p>
          </div>
        )}
      </div>
      
      {/* Create Project Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-neutral-900">
              {isEditing ? "Edit Project" : "Create New Project"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input 
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="e.g. Summer Vegetable Garden"
              />
            </div>
            
            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea 
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Describe your project..."
              />
            </div>
            
            <div>
              <Label htmlFor="project-status">Status</Label>
              <Select 
                value={status} 
                onValueChange={setStatus}
              >
                <SelectTrigger className="w-full mt-1" id="project-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="project-color">Project Color</Label>
              <Select 
                value={color} 
                onValueChange={(val) => {
                  setColor(val);
                  setShowColorPicker(val === "custom");
                }}
              >
                <SelectTrigger className="w-full mt-1" id="project-color">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.value && (
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ 
                              backgroundColor: option.value === "custom" ? customColor : option.value || "#6366f1" 
                            }}
                          ></div>
                        )}
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {showColorPicker && (
                <div className="mt-2">
                  <Label htmlFor="custom-color">Pick Custom Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="color" 
                      id="custom-color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-10 h-10 p-1 rounded cursor-pointer"
                    />
                    <Input 
                      type="text" 
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="flex-1"
                      placeholder="#HEX"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project-start">Start Date</Label>
                <Input 
                  type="date" 
                  id="project-start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="project-end">End Date</Label>
                <Input 
                  type="date" 
                  id="project-end"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary-dark"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending 
                  ? (isEditing ? "Updating..." : "Creating...") 
                  : (isEditing ? "Update Project" : "Create Project")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* View Project Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-medium text-neutral-900 flex justify-between items-center">
                  <span>{selectedProject.name}</span>
                  <span className={`text-sm ${getStatusColor(selectedProject.status)}`}>
                    {selectedProject.status.charAt(0).toUpperCase() + selectedProject.status.slice(1)}
                  </span>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Description</h3>
                  <p className="mt-1 text-neutral-800">{selectedProject.description || "No description provided."}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Start Date</h3>
                    <p className="mt-1 text-neutral-800">
                      {selectedProject.startDate 
                        ? formatDate(new Date(selectedProject.startDate), { dateStyle: 'medium' }) 
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">End Date</h3>
                    <p className="mt-1 text-neutral-800">
                      {selectedProject.endDate 
                        ? formatDate(new Date(selectedProject.endDate), { dateStyle: 'medium' }) 
                        : "Not specified"}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Progress</h3>
                  <div className="mt-1 h-2 bg-neutral-200 rounded">
                    <div 
                      className="h-full bg-primary rounded"
                      style={{ width: `${selectedProject.progress}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-xs text-right text-neutral-500">{selectedProject.progress}% completed</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Upcoming Events</h3>
                  {isLoadingEvents ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-5 bg-neutral-200 rounded w-full"></div>
                      <div className="h-5 bg-neutral-200 rounded w-full"></div>
                    </div>
                  ) : projectEvents.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {projectEvents.map(event => (
                        <div key={event.id} className="p-2 bg-neutral-50 rounded text-sm">
                          <div className="font-medium">{event.title}</div>
                          <div className="text-xs text-neutral-500">
                            {formatDate(new Date(event.startDate), { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No upcoming events for this project.</p>
                  )}
                </div>
              </div>
              
              <DialogFooter className="flex gap-2">
                <Button 
                  onClick={() => setIsViewModalOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedProject && window.confirm(`Delete project "${selectedProject.name}"? This will also remove all associated events.`)) {
                      deleteProjectMutation.mutate(selectedProject.id);
                    }
                  }}
                  variant="destructive"
                  disabled={deleteProjectMutation.isPending}
                >
                  {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
                <Button 
                  onClick={() => {
                    // Pre-fill form with selected project data
                    setName(selectedProject.name);
                    setDescription(selectedProject.description || "");
                    setStatus(selectedProject.status);
                    setStartDate(selectedProject.startDate 
                      ? new Date(selectedProject.startDate).toISOString().split('T')[0]
                      : "");
                    setEndDate(selectedProject.endDate
                      ? new Date(selectedProject.endDate).toISOString().split('T')[0]
                      : "");
                    
                    // Handle color pre-filling
                    const existingColor = selectedProject.color;
                    if (!existingColor) {
                      setColor("default");
                    } else if (colorOptions.some(option => option.value === existingColor)) {
                      setColor(existingColor);
                      setShowColorPicker(false);
                    } else {
                      setColor("custom");
                      setCustomColor(existingColor);
                      setShowColorPicker(true);
                    }
                    
                    // Close view modal and open create/edit modal
                    setIsViewModalOpen(false);
                    setIsCreateModalOpen(true);
                    setIsEditing(true);
                  }}
                  className="bg-primary hover:bg-primary-dark"
                >
                  Edit Project
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
