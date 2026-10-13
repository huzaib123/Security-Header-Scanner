import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/shield.svg" alt="" width="24" height="24" />
          <span>HeaderScan</span>
        </Link>
        <a className="muted" href="https://github.com/huzaib123/Security-Header-Scanner">GitHub</a>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scans/:id" element={<ScanPage />} />
          <Route path="*" element={<p className="muted">Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
    </div>
  );
}
