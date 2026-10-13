export default function GradeBadge({ grade, size = 'sm' }) {
  if (!grade) return <span className={`grade grade-${size} grade-none`}>–</span>;
  return <span className={`grade grade-${size} grade-${grade.toLowerCase()}`}>{grade}</span>;
}
