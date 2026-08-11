import type { Audit } from '../lib/types';
export function AuditResult({ audit }: { audit: Audit }) {
  return (
    <section className="results">
      <div className={`score ${audit.overall}`}>
        <strong>{audit.score}</strong>
        <span>{audit.overall}</span>
      </div>
      <div className="checks">
        {audit.checks.map((check) => (
          <article key={check.id} className="check">
            <span className={`status ${check.status}`}>{check.status}</span>
            <div>
              <h3>{check.title}</h3>
              <p>{check.message}</p>
            </div>
          </article>
        ))}
      </div>
      <h2>Recommendations</h2>
      <ul>
        {audit.recommendations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="disclaimer">{audit.disclaimer}</p>
    </section>
  );
}
