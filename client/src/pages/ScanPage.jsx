import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetScanQuery, errorMessage } from '../services/api';
import { selectLastResponse } from '../features/scanSlice';
import GradeBadge from '../components/GradeBadge';
import CheckRow from '../components/CheckRow';
import ScanForm from '../components/ScanForm';
import HistoryTable from '../components/HistoryTable';
import { GRADE_TEXT, isFinished, shortUrl, timeAgo } from '../utils/format';

const POLL_MS = 1000;

function Pending({ scan }) {
  return (
    <section className="card pending" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <div>
        <h2>{scan.status === 'running' ? 'Scanning…' : 'Waiting in the queue…'}</h2>
        <p className="muted mono">{scan.url}</p>
        <p className="muted">The scan runs in the background. This page checks for the result every second.</p>
      </div>
    </section>
  );
}

function Failed({ scan }) {
  return (
    <section className="card failed">
      <h2>Scan failed</h2>
      <p className="mono">{scan.url}</p>
      <p className="form-error">{scan.error}</p>
    </section>
  );
}

function Result({ scan, fromCache }) {
  const failed = scan.checks.filter((c) => c.status !== 'pass').length;
  return (
    <>
      <section className="card result-head">
        <GradeBadge grade={scan.grade} size="lg" />
        <div className="result-meta">
          <p className="result-grade-text">
            {GRADE_TEXT[scan.grade]} <span className="muted">· {scan.score}/100</span>
          </p>
          <h2 className="mono break">{shortUrl(scan.finalUrl || scan.url)}</h2>
          <div className="tags">
            <span className={`tag ${scan.httpsAvailable ? 'tag-ok' : 'tag-bad'}`}>{scan.httpsAvailable ? 'HTTPS works' : 'No HTTPS'}</span>
            {scan.httpRedirectsToHttps === true && <span className="tag tag-ok">HTTP → HTTPS</span>}
            {scan.httpRedirectsToHttps === false && <span className="tag tag-bad">HTTP not redirected</span>}
            <span className="tag">HTTP {scan.statusCode}</span>
            <span className="tag">{scan.durationMs} ms</span>
            {fromCache && <span className="tag tag-cache">From cache</span>}
            <span className="tag">{timeAgo(scan.finishedAt || scan.createdAt)}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Checks</h2>
          <span className="muted">{failed === 0 ? 'All passed' : `${failed} to fix`}</span>
        </div>
        <ul className="checks">
          {scan.checks.map((c) => <CheckRow key={c.id} check={c} />)}
        </ul>
      </section>

      <div className="two-col">
        {scan.redirects?.length > 1 && (
          <section className="card">
            <h2>Redirects</h2>
            <ol className="redirects">
              {scan.redirects.map((r) => (
                <li key={r.url}><span className="tag">{r.statusCode}</span> <span className="mono break">{r.url}</span></li>
              ))}
            </ol>
          </section>
        )}
        <section className="card">
          <details>
            <summary><h2>Raw response headers</h2></summary>
            <dl className="headers">
              {Object.entries(scan.headers || {}).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd className="mono break">{v}</dd></div>
              ))}
            </dl>
          </details>
          {scan.httpsError && <p className="muted">HTTPS: {scan.httpsError}</p>}
        </section>
      </div>
    </>
  );
}

export default function ScanPage() {
  const { id } = useParams();
  const [pollingInterval, setPollingInterval] = useState(POLL_MS);
  const { data: scan, error, isLoading } = useGetScanQuery(id, { pollingInterval });
  const last = useSelector(selectLastResponse);

  // Poll every second until the worker finishes, then stop.
  useEffect(() => {
    setPollingInterval(scan && isFinished(scan.status) ? 0 : POLL_MS);
  }, [scan]);

  return (
    <>
      <div className="page-top">
        <Link to="/" className="back">← New scan</Link>
        <ScanForm compact />
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{errorMessage(error, 'Scan not found')}</p>}
      {scan && !isFinished(scan.status) && <Pending scan={scan} />}
      {scan?.status === 'failed' && <Failed scan={scan} />}
      {scan?.status === 'completed' && <Result scan={scan} fromCache={last?.id === scan.id && last.cached} />}
      {scan && <HistoryTable url={scan.url} title="Earlier scans of this address" excludeId={scan.id} />}
    </>
  );
}
