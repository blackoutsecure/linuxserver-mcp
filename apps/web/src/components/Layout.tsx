import {
  Box,
  CircleHelp,
  FileSearch,
  House,
  Menu,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home', icon: House },
  { to: '/images', label: 'Images', icon: Search },
  { to: '/audit', label: 'Audit', icon: ShieldCheck },
  { to: '/requests', label: 'Requests', icon: FileSearch },
  { to: '/about', label: 'About', icon: CircleHelp }
];
export function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <header>
        <NavLink to="/" className="brand">
          <Box />
          <span>
            LSIO <strong>MCP</strong>
          </span>
        </NavLink>
        <button
          className="icon-button menu"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? 'open' : ''}>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <span>Community project sponsored by Blackout Secure.</span>
        <a href="https://www.linuxserver.io/donate">Support LinuxServer.io</a>
      </footer>
    </div>
  );
}
