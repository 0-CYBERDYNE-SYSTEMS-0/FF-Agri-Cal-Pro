import { useCalendar } from "@/contexts/CalendarContext";
import { useEffect } from "react";

export default function ViewDebugger() {
  const { view, forceRender } = useCalendar();
  
  useEffect(() => {
    console.log("ViewDebugger rendered with view:", view, "forceRender:", forceRender);
  }, [view, forceRender]);
  
  // This component visually shows which view is currently active
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded-lg z-50 text-xs">
      <div>Current View: <strong>{view}</strong></div>
      <div>Force Render: {forceRender}</div>
    </div>
  );
} 