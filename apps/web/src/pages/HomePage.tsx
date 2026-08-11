import {
  ArrowRight,
  FileSearch,
  Search,
  ShieldCheck,
  Workflow
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageSearch } from '../components/ImageSearch';
export function HomePage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const search = () => {
    const normalized = query.trim();
    if (normalized)
      void navigate(`/images?query=${encodeURIComponent(normalized)}`);
  };
  const actions = [
    {
      to: '/images',
      icon: Search,
      title: 'Find an image',
      text: 'Search current metadata by name, category, architecture, or tag.'
    },
    {
      to: '/audit',
      icon: ShieldCheck,
      title: 'Audit a container',
      text: 'Review Compose or docker run text against documented conventions.'
    },
    {
      to: '/requests',
      icon: FileSearch,
      title: 'Research requests',
      text: 'Search open and closed Image Requests before creating a duplicate.'
    },
    {
      to: '/requests?pipeline=1',
      icon: Workflow,
      title: 'Run the pipeline',
      text: 'Check inventory, request history, and known-issue context together.'
    }
  ];
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Community MCP server + registry UI</div>
        <h1>
          LinuxServer.io
          <br />
          <span>Image Registry</span>
        </h1>
        <p>
          Discover images, inspect container usage, and research request history
          using public LinuxServer.io sources.
        </p>
        <div className="hero-search">
          <ImageSearch value={query} onChange={setQuery} onSubmit={search} />
        </div>
        <div className="hero-actions">
          <Link className="primary" to="/images">
            Search images <ArrowRight size={17} />
          </Link>
          <Link to="/audit">Run an audit</Link>
        </div>
      </section>
      <p className="disclaimer prominent">
        Audit results are derived from public LinuxServer.io documentation and
        are intended as community guidance. They are not an official
        LinuxServer.io certification, support decision, or approval decision.
      </p>
      <section className="action-grid">
        {actions.map(({ to, icon: Icon, title, text }) => (
          <Link to={to} key={to}>
            <Icon />
            <h2>{title}</h2>
            <p>{text}</p>
            <ArrowRight className="arrow" />
          </Link>
        ))}
      </section>
    </>
  );
}
