import { Project } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { getProjectColor, getStatusColor } from "@/lib/colorUtils";

interface ProjectCardProps {
  project: Project;
  onSelect?: () => void;
}

export default function ProjectCard({ project, onSelect }: ProjectCardProps) {
  const { id, name, description, status, startDate, endDate, progress } = project;
  const projectColor = getProjectColor(project);
  
  // Format date range
  const formatDateRange = () => {
    if (!startDate && !endDate) return "No dates specified";
    
    if (!startDate) return `Until ${new Date(endDate!).toLocaleDateString()}`;
    
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
  const getStatusBadge = () => getStatusColor(status);

  // Extract hex color from Tailwind class with square brackets
  const extractHexColor = (className: string): string | undefined => {
    if (className.includes('[') && className.includes(']')) {
      const start = className.indexOf('[') + 1;
      const end = className.indexOf(']');
      return className.substring(start, end);
    }
    return undefined;
  };

  // Get color styles based on the project color
  const colorStyles = {
    topBar: projectColor.bg.includes('[') 
      ? { backgroundColor: extractHexColor(projectColor.bg) } 
      : {},
    border: projectColor.border.includes('[') 
      ? { borderColor: extractHexColor(projectColor.border) } 
      : {},
    text: projectColor.lightText.includes('[') 
      ? { color: extractHexColor(projectColor.lightText) } 
      : {},
    progressBar: projectColor.bg.includes('[') 
      ? { backgroundColor: extractHexColor(projectColor.bg) } 
      : {}
  };

  return (
    <Card 
      className="shadow hover:shadow-md transition cursor-pointer overflow-hidden border-0" 
      onClick={onSelect}
    >
      {/* Project color bar */}
      <div 
        className={`h-2 w-full ${!projectColor.bg.includes('[') ? projectColor.bg : ''}`}
        style={colorStyles.topBar}
      ></div>
      
      {/* Card content */}
      <CardContent 
        className={`p-4 border-l-4 ${!projectColor.border.includes('[') ? projectColor.border : ''}`}
        style={colorStyles.border}
      >
        <div className="flex justify-between items-start">
          <h3 
            className={`font-medium ${!projectColor.lightText.includes('[') ? projectColor.lightText : ''}`}
            style={colorStyles.text}
          >
            {name}
          </h3>
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
                <span 
                  className={`text-xs font-semibold inline-block ${!projectColor.lightText.includes('[') ? projectColor.lightText : ''}`}
                  style={colorStyles.text}
                >
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span 
                  className={`text-xs font-semibold inline-block ${!projectColor.lightText.includes('[') ? projectColor.lightText : ''}`}
                  style={colorStyles.text}
                >
                  {progress}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
              <div 
                className={`h-full ${!projectColor.bg.includes('[') ? projectColor.bg : ''}`} 
                style={{
                  width: `${progress || 0}%`,
                  ...colorStyles.progressBar
                }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
