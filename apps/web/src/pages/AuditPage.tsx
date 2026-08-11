import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuditResult } from '../components/AuditResult';
import { api } from '../lib/api';
import type { Audit } from '../lib/types';
export function AuditPage() {
  const [params] = useSearchParams();
  const [imageName, setImageName] = useState(params.get('image') ?? '');
  const [mode, setMode] = useState<'compose' | 'run'>('compose');
  const [text, setText] = useState('');
  const [audit, setAudit] = useState<Audit>();
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    try {
      setAudit(
        await api.audit({
          imageName,
          ...(mode === 'compose'
            ? { composeYaml: text }
            : { dockerRunCommand: text })
        })
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audit failed');
    }
  };
  return (
    <section>
      <div className="page-heading">
        <span>Documentation-derived review</span>
        <h1>Container audit</h1>
        <p>Submitted content is parsed as text. It is never executed.</p>
      </div>
      <div className="tool-panel">
        <label>
          Image name
          <input
            value={imageName}
            onChange={(event) => setImageName(event.target.value)}
            placeholder="sonarr"
          />
        </label>
        <div className="segmented">
          <button
            className={mode === 'compose' ? 'active' : ''}
            onClick={() => setMode('compose')}
          >
            Compose YAML
          </button>
          <button
            className={mode === 'run' ? 'active' : ''}
            onClick={() => setMode('run')}
          >
            docker run
          </button>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={13}
          spellCheck={false}
          placeholder={
            mode === 'compose'
              ? 'services:\n  app:\n    image: lscr.io/linuxserver/…'
              : 'docker run …'
          }
        />
        <button className="primary" onClick={submit}>
          Run audit
        </button>
        {error && <p className="error">{error}</p>}
      </div>
      {audit && <AuditResult audit={audit} />}
    </section>
  );
}
