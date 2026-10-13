import ScanForm from '../components/ScanForm';
import HistoryTable from '../components/HistoryTable';

const CHECKS = ['HTTPS redirect', 'HSTS', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Server / X-Powered-By leaks'];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>How secure are a website&apos;s headers?</h1>
        <p className="lead">Enter an address to check its HTTPS setup and security headers. You get a grade from A to F and a one-line fix for every problem.</p>
        <ScanForm />
        <ul className="check-pills" aria-label="What is checked">
          {CHECKS.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <p className="fine-print">Only public websites can be scanned. The scanner sends normal GET requests, nothing else.</p>
      </section>
      <HistoryTable title="Recent scans" />
    </>
  );
}
