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
        <h1>About this registry</h1>
        <p>
          Provided by Blackout Secure and sponsored by Blackout Secure for the
          LinuxServer.io community.
        </p>
      </div>
      <p className="disclaimer prominent">
        Audit results are derived from public LinuxServer.io documentation and
        are intended as community guidance. They are not an official
        LinuxServer.io certification, support decision, or approval decision.
      </p>
      <div className="prose">
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
