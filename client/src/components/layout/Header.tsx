import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "./Navigation";
import { useWeather } from "@/hooks/use-weather";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Header() {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const { weatherData = [], isLoading, error } = useWeather();

  const currentWeather = weatherData?.[0];

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const closeUserMenu = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('#user-menu-btn')) {
      setIsUserMenuOpen(false);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="font-serif font-bold text-xl text-primary">FF Agri-Cal</span>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <button id="weather-btn" className="flex items-center text-neutral-600 hover:text-primary transition">
                <span className="mr-1">{currentWeather?.icon || "🌤️"}</span>
                <span>
                  {currentWeather?.temperature != null
                    ? `${currentWeather.temperature}°F`
                    : isLoading
                      ? "Loading..."
                      : error
                        ? "Error"
                        : "-"}
                </span>
              </button>
              <NotificationBell />
              <div className="relative">
                <button 
                  id="user-menu-btn" 
                  className="flex items-center space-x-2 text-neutral-600 hover:text-primary transition"
                  onClick={toggleUserMenu}
                >
                  <img 
                    src={user.profileImage || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"} 
                    alt="User profile" 
                    className="h-8 w-8 rounded-full"
                  />
                  <span>{user.displayName}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* User dropdown menu */}
                {isUserMenuOpen && (
                  <div id="user-menu" className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 text-sm text-neutral-500 border-b">{user.displayName}</div>
                    <button 
                      onClick={() => { logout(); setIsUserMenuOpen(false); }} 
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Navigation />
    </header>
  );
}
