import { useLocation } from "wouter";

interface NavLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
}

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <a
      href={href}
      className={`${
        active
          ? "border-primary text-primary"
          : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
      } font-medium py-4 px-1 border-b-2 cursor-pointer`}
    >
      {children}
    </a>
  );
}

export default function Navigation() {
  const [location] = useLocation();

  return (
    <div className="border-b border-neutral-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mb-px flex space-x-8">
        <NavLink href="/" active={location === "/"}>
          Calendar
        </NavLink>
        <NavLink href="/projects" active={location === "/projects"}>
          Projects
        </NavLink>
        <NavLink href="/assistant" active={location === "/assistant"}>
          Farm Friend
        </NavLink>
        <NavLink href="/weather" active={location === "/weather"}>
          Weather
        </NavLink>
      </nav>
    </div>
  );
}
