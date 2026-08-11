import { ExternalLink } from 'lucide-react';
export function SourceLinks({ links }: { links: string[] }) {
  return (
    <div className="source-links">
      {links.map((link) => (
        <a key={link} href={link} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          Source
        </a>
      ))}
    </div>
  );
}
