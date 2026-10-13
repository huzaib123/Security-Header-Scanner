const ICONS = { pass: '✓', warn: '!', fail: '✕' };

export default function CheckRow({ check }) {
  return (
    <li className={`check check-${check.status}`}>
      <span className="check-icon" aria-label={check.status}>{ICONS[check.status]}</span>
      <div className="check-body">
        <div className="check-title">
          <span className="check-name">{check.name}</span>
          <span className="check-points">{check.points}/{check.maxPoints}</span>
        </div>
        <p className="check-message">{check.message}</p>
        {check.value && <code className="check-value">{check.value}</code>}
        {check.fix && (
          <p className="check-fix">
            <strong>Fix:</strong> {check.fix}
          </p>
        )}
      </div>
    </li>
  );
}
