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

export default function Projects() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project created",
        description: "Your project has been created successfully."
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem creating your project.",
        variant: "destructive"
      });
      console.error("Error creating project:", error);
    }
  });
  
  const { data: projectEvents = [], isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ["/api/events", selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return [];
      const response = await apiRequest("GET", `/api/events?projectId=${selectedProject.id}`);
      return response.json();
    },
    enabled: !!selectedProject
  });
  
  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("planning");
    setStartDate("");
    setEndDate("");
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
      progress: 0
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Projects</h1>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
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
              Create New Project
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
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
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
              
              <DialogFooter>
                <Button 
                  onClick={() => setIsViewModalOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
                <Button className="bg-primary hover:bg-primary-dark">
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
