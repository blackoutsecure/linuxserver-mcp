import { useState } from 'react';
import { ExternalLink, FilePlus2, Workflow } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Pipeline, RequestResult } from '../lib/types';
export function RequestsPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') ?? '');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('activity');
  const [results, setResults] = useState<RequestResult[]>([]);
  const [draft, setDraft] = useState('');
  const [pipeline, setPipeline] = useState<Pipeline>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const changeQuery = (value: string) => {
    setQuery(value);
    setPipeline(undefined);
    setDraft('');
  };
  const search = async () => {
    setError('');
    setPipeline(undefined);
    setDraft('');
    try {
      const output = await api.requests(
        new URLSearchParams({ query, status, sort })
      );
      setResults(output.results);
      setNotice(output.notice ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed');
    }
  };
  const runPipeline = async () => {
    setError('');
    try {
      setPipeline(await api.pipeline({ imageName: query }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pipeline failed');
    }
  };
  const prepare = async () => {
    setError('');
    try {
      setDraft((await api.prepare({ appName: query })).draftMarkdown);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Draft failed');
    }
  };
  return (
    <section>
      <div className="page-heading">
        <span>Duplicate prevention</span>
        <h1>Image request research</h1>
        <p>
          Open and closed discussions are searched because closure context can
          reveal duplicates, prior decisions, or images added later.
        </p>
      </div>
      <div className="search-box">
        <input
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Application name"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Open + closed</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="activity">Activity</option>
          <option value="created">Created</option>
          <option value="comments">Comments</option>
          <option value="relevance">Relevance</option>
        </select>
        <button onClick={search}>Search</button>
      </div>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <div className="request-list">
        {results.map((item) => (
          <article key={item.discussionUrl}>
            <div className="request-meta">
              <span className={`status ${item.status}`}>{item.status}</span>
              <span>{item.requestInterpretation.replaceAll('_', ' ')}</span>
              {item.comments !== undefined && (
                <span>{item.comments} comments</span>
              )}
              {item.communitySignals?.isDuplicateCandidate && (
                <span>duplicate candidate</span>
              )}
            </div>
            <h2>{item.title}</h2>
            <p>{item.nextBestAction}</p>
            <a href={item.discussionUrl} target="_blank" rel="noreferrer">
              View discussion <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
      <div className="request-actions">
        <button disabled={!query} onClick={runPipeline}>
          <Workflow size={16} /> Run pipeline
        </button>
        <button className="primary" disabled={!query} onClick={prepare}>
          <FilePlus2 size={16} /> Prepare request draft
        </button>
      </div>
      {pipeline && (
        <section className="pipeline-result">
          <span className="status">
            {pipeline.recommendation.replaceAll('_', ' ')}
          </span>
          <h2>{pipeline.reason}</h2>
          <p>{pipeline.nextBestAction}</p>
          <p className="disclaimer">{pipeline.disclaimer}</p>
        </section>
      )}
      {draft && (
        <textarea
          className="draft"
          value={draft}
          readOnly
          rows={24}
          aria-label="Prepared Markdown draft"
        />
      )}
    </section>
  );
}
