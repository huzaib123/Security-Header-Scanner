import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckRow from './CheckRow';
import GradeBadge from './GradeBadge';

describe('CheckRow', () => {
  test('shows the fix for a failed check', () => {
    render(<CheckRow check={{ id: 'hsts', name: 'Strict-Transport-Security', status: 'fail', points: 0, maxPoints: 15, message: 'Missing', fix: 'Add HSTS', value: null }} />);
    expect(screen.getByText('Strict-Transport-Security')).toBeInTheDocument();
    expect(screen.getByText('Add HSTS')).toBeInTheDocument();
    expect(screen.getByText('0/15')).toBeInTheDocument();
  });

  test('shows the header value and no fix for a passed check', () => {
    render(<CheckRow check={{ id: 'xcto', name: 'X-Content-Type-Options', status: 'pass', points: 10, maxPoints: 10, message: 'ok', fix: null, value: 'nosniff' }} />);
    expect(screen.getByText('nosniff')).toBeInTheDocument();
    expect(screen.queryByText(/Fix:/)).toBeNull();
  });
});

describe('GradeBadge', () => {
  test('colours by grade', () => {
    render(<GradeBadge grade="B" size="lg" />);
    expect(screen.getByText('B')).toHaveClass('grade-b', 'grade-lg');
  });
});
