import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useCreateScanMutation, errorMessage } from '../services/api';
import { inputChanged, scanSubmitted, selectInput } from '../features/scanSlice';

export default function ScanForm({ compact = false }) {
  const input = useSelector(selectInput);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [createScan, { isLoading, error }] = useCreateScanMutation();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createScan(input.trim()).unwrap();
      dispatch(scanSubmitted({ id: res.data.id, cached: res.cached, deduplicated: res.deduplicated }));
      navigate(`/scans/${res.data.id}`);
    } catch {
      // Shown below from the mutation state.
    }
  };

  return (
    <form className={`scan-form ${compact ? 'compact' : ''}`} onSubmit={onSubmit}>
      <div className="scan-input">
        <input
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck="false"
          placeholder="example.com"
          aria-label="Website address"
          required
          maxLength={2048}
          value={input}
          onChange={(e) => dispatch(inputChanged(e.target.value))}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Starting…' : 'Scan'}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{errorMessage(error, 'Could not start the scan')}</p>}
    </form>
  );
}
