// Project color utility functions
export const PROJECT_COLORS = [
  {
    bg: "bg-green-600",
    text: "text-white",
    light: "bg-green-100",
    lightText: "text-green-700",
    border: "border-green-600"
  },
  {
    bg: "bg-indigo-600",
    text: "text-white",
    light: "bg-indigo-100",
    lightText: "text-indigo-700",
    border: "border-indigo-600"
  },
  {
    bg: "bg-amber-600",
    text: "text-white",
    light: "bg-amber-100",
    lightText: "text-amber-700",
    border: "border-amber-600"
  },
  {
    bg: "bg-rose-600",
    text: "text-white",
    light: "bg-rose-100",
    lightText: "text-rose-700",
    border: "border-rose-600"
  },
  {
    bg: "bg-teal-600",
    text: "text-white",
    light: "bg-teal-100",
    lightText: "text-teal-700",
    border: "border-teal-600"
  },
  {
    bg: "bg-blue-600",
    text: "text-white",
    light: "bg-blue-100",
    lightText: "text-blue-700",
    border: "border-blue-600"
  },
  {
    bg: "bg-purple-600",
    text: "text-white",
    light: "bg-purple-100",
    lightText: "text-purple-700",
    border: "border-purple-600"
  },
  {
    bg: "bg-stone-600",
    text: "text-white",
    light: "bg-stone-100",
    lightText: "text-stone-700",
    border: "border-stone-600"
  }
];

// Function to convert hex color to Tailwind-like color object
export function hexToColorObject(hexColor: string) {
  // Default text color - white for dark colors, dark for light colors
  const isLight = isLightColor(hexColor);
  const lightColor = lightenColor(hexColor, 0.85);
  const darkColor = darkenColor(hexColor, 0.2);
  
  return {
    bg: `bg-[${hexColor}]`,
    text: isLight ? "text-neutral-800" : "text-white",
    light: `bg-[${lightColor}]`,
    lightText: `text-[${darkColor}]`,
    border: `border-[${hexColor}]`
  };
}

// Check if a color is light or dark
function isLightColor(hexColor: string) {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if the color is light (luminance > 0.5)
  return luminance > 0.5;
}

// Lighten a color by a certain amount
function lightenColor(hexColor: string, amount: number) {
  return adjustColor(hexColor, amount, true);
}

// Darken a color by a certain amount
function darkenColor(hexColor: string, amount: number) {
  return adjustColor(hexColor, amount, false);
}

// Adjust a hex color by a certain amount
function adjustColor(hexColor: string, amount: number, lighten: boolean) {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert to RGB
  let r = parseInt(hexColor.substr(0, 2), 16);
  let g = parseInt(hexColor.substr(2, 2), 16);
  let b = parseInt(hexColor.substr(4, 2), 16);
  
  // Adjust color
  if (lighten) {
    r = Math.min(255, Math.floor(r + (255 - r) * amount));
    g = Math.min(255, Math.floor(g + (255 - g) * amount));
    b = Math.min(255, Math.floor(b + (255 - b) * amount));
  } else {
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
  }
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get color for a specific project ID or project object
export const getProjectColor = (projectIdOrObject: number | undefined | { id: number, color?: string | null }) => {
  // If it's a project object with a custom color
  if (typeof projectIdOrObject === 'object' && projectIdOrObject !== null) {
    if (projectIdOrObject.color) {
      // Make sure the color is a valid hex color
      if (projectIdOrObject.color.startsWith('#')) {
        return hexToColorObject(projectIdOrObject.color);
      }
      // If it's not a hex color but a named color, return the preset
      for (let i = 0; i < PROJECT_COLORS.length; i++) {
        // Check against the predefined colors
        if (PROJECT_COLORS[i].bg.includes(projectIdOrObject.color.replace('#', ''))) {
          return PROJECT_COLORS[i];
        }
      }
    }
    return PROJECT_COLORS[(projectIdOrObject.id - 1) % PROJECT_COLORS.length];
  }
  
  // If it's just an ID
  if (!projectIdOrObject) return PROJECT_COLORS[PROJECT_COLORS.length - 1]; // Default color for no project
  return PROJECT_COLORS[(projectIdOrObject - 1) % PROJECT_COLORS.length];
};

// Get background color for project status
export const getStatusColor = (status: string) => {
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

// Get text color for project status
export const getStatusTextColor = (status: string) => {
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