import { Project } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProjectCardProps {
  project: Project;
  onSelect?: () => void;
}

export default function ProjectCard({ project, onSelect }: ProjectCardProps) {
  const { name, description, status, startDate, endDate, progress } = project;
  
  // Format date range
  const formatDateRange = () => {
    if (!startDate && !endDate) return "No dates specified";
    
    if (!startDate) return `Until ${new Date(endDate).toLocaleDateString()}`;
    
    if (!endDate) return `From ${new Date(startDate).toLocaleDateString()}`;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same year, show only month for start date
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { month: 'short' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
    
    return `${start.getFullYear()} - ${end.getFullYear()}`;
  };
  
  // Get status badge style
  const getStatusBadge = () => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "planning":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-purple-100 text-purple-800";
      case "ongoing":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };

  return (
    <Card className="shadow hover:shadow-md transition cursor-pointer" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-neutral-800">{name}</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge()}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        
        {description && (
          <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{description}</p>
        )}
        
        <div className="mt-3 flex items-center text-sm text-neutral-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDateRange()}</span>
        </div>
        
        <div className="mt-4">
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-primary">
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-primary">
                  {progress}%
                </span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
