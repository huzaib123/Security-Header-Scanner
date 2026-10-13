import { Link } from 'react-router-dom';
import { useGetHistoryQuery, errorMessage } from '../services/api';
import GradeBadge from './GradeBadge';
import { shortUrl, timeAgo } from '../utils/format';

export default function HistoryTable({ url, title, excludeId }) {
  const { data, isLoading, error } = useGetHistoryQuery({ url, limit: 10 }, { pollingInterval: 5000, refetchOnFocus: true });
  const rows = (data?.data ?? []).filter((s) => s.id !== excludeId);

  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {data && <span className="muted">{data.total} total</span>}
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{errorMessage(error)}</p>}
      {data && rows.length === 0 && <p className="muted">No scans yet.</p>}
      {rows.length > 0 && (
        <table className="history">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Address</th>
              <th>Status</th>
              <th className="right">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((scan) => (
              <tr key={scan.id}>
                <td><GradeBadge grade={scan.grade} /></td>
                <td className="mono"><Link to={`/scans/${scan.id}`}>{shortUrl(scan.url)}</Link></td>
                <td><span className={`status status-${scan.status}`}>{scan.status}</span></td>
                <td className="right muted">{timeAgo(scan.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
