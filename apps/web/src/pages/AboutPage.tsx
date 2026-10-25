const sources = [
  ['Documentation', 'https://docs.linuxserver.io/'],
  ['API documentation', 'https://docs.linuxserver.io/API/'],
  ['Image catalog', 'https://www.linuxserver.io/our-images'],
  ['Known issues', 'https://info.linuxserver.io/'],
  ['Status', 'https://status.linuxserver.io/'],
  ['Support', 'https://www.linuxserver.io/support'],
  ['Donate', 'https://www.linuxserver.io/donate'],
  [
    'Image Requests',
    'https://github.com/orgs/linuxserver/discussions/categories/image-requests'
  ]
];
export function AboutPage() {
  return (
    <section>
      <div className="page-heading">
        <span>Project boundaries</span>
        <h1>About LinuxServer MCP</h1>
        <p>
          Independent community tooling maintained by Blackout Secure for the
          LinuxServer.io ecosystem.
        </p>
      </div>
      <p className="disclaimer prominent">
        This project is not affiliated with, endorsed by, sponsored by, or
        maintained by LinuxServer.io. Findings are community guidance, not
        certification, support decisions, or approval.
      </p>
      <div className="prose">
        <h2>One canonical project</h2>
        <p>
          <a href="https://github.com/blackoutsecure/linuxserver-mcp">
            LinuxServer MCP
          </a>{' '}
          combines a shared policy/audit engine, MCP server, local CLI, and
          read-only GitHub Action. All 25 MCP tools include repository
          snapshots, image discovery, scaffolding, and guidance. This web
          interface covers image discovery, usage audits, and request research.
          The optional GitHub App and authenticated write automation remain
          planned.
        </p>
        <h2>Community scope</h2>
        <p>
          This project does not speak for LinuxServer.io. It does not certify
          containers, submit requests, comment, react, or automatically plus-one
          discussions. Drafts and recommendations remain yours to review.
        </p>
        <h2>Public sources</h2>
        <ul>
          {sources.map(([title, url]) => (
            <li key={url}>
              <a href={url}>{title}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
