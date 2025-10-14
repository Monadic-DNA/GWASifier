"use client";

type RunAllModalProps = {
  isOpen: boolean;
  onClose: () => void;
  status: {
    phase: 'fetching' | 'analyzing' | 'complete' | 'error';
    fetchedBatches: number;
    totalStudiesFetched: number;
    totalInDatabase: number;
    matchingStudies: number;
    processedCount: number;
    totalToProcess: number;
    matchCount: number;
    startTime?: number;
    elapsedSeconds?: number;
    etaSeconds?: number;
    errorMessage?: string;
  };
};

export default function RunAllModal({ isOpen, onClose, status }: RunAllModalProps) {
  if (!isOpen) return null;

  const canClose = status.phase === 'complete' || status.phase === 'error';

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="modal-overlay" onClick={canClose ? onClose : undefined}>
      <div className="modal-content run-all-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Run All Analysis</h2>
          {canClose && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>

        <div className="modal-body">
          {status.phase === 'fetching' && (
            <div className="status-section">
              <div className="status-header">
                <div className="spinner"></div>
                <h3>Fetching Studies...</h3>
              </div>
              <div className="status-details">
                <p>Batches fetched: <strong>{status.fetchedBatches}</strong></p>
                <p>Total studies fetched: <strong>{status.totalStudiesFetched.toLocaleString()}</strong></p>
                <p>Studies matching your SNPs: <strong>{status.matchingStudies.toLocaleString()}</strong></p>
              </div>
            </div>
          )}

          {status.phase === 'analyzing' && (
            <div className="status-section">
              <div className="status-header">
                <div className="spinner"></div>
                <h3>Processing Studies...</h3>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${status.totalInDatabase > 0 ? (status.totalStudiesFetched / status.totalInDatabase) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="status-details">
                {status.totalInDatabase > 0 && (
                  <p>Database: <strong>{status.totalInDatabase.toLocaleString()}</strong> studies with SNP data</p>
                )}
                <p>Fetched: <strong>{status.totalStudiesFetched.toLocaleString()}</strong> / {status.totalInDatabase > 0 ? status.totalInDatabase.toLocaleString() : '...'} ({status.fetchedBatches} batches)</p>
                <p>Matching your SNPs: <strong>{status.matchingStudies.toLocaleString()}</strong> analyzed ({status.matchCount.toLocaleString()} matches)</p>
                {status.elapsedSeconds !== undefined && (
                  <p>Elapsed: <strong>{formatTime(status.elapsedSeconds)}</strong></p>
                )}
                {status.etaSeconds !== undefined && status.etaSeconds > 0 && (
                  <p>ETA: <strong>{formatTime(status.etaSeconds)}</strong></p>
                )}
                <p className="status-hint">Analysis happens instantly as studies are downloaded...</p>
              </div>
            </div>
          )}

          {status.phase === 'complete' && (
            <div className="status-section complete">
              <div className="status-header">
                <span className="success-icon">✓</span>
                <h3>Analysis Complete!</h3>
              </div>
              <div className="status-details">
                <p>Fetched: <strong>{status.totalStudiesFetched.toLocaleString()}</strong> studies from database</p>
                <p>Analyzed: <strong>{status.matchingStudies.toLocaleString()}</strong> matching your SNPs</p>
                <p>Matches found: <strong>{status.matchCount.toLocaleString()}</strong></p>
                {status.elapsedSeconds !== undefined && (
                  <p>Total time: <strong>{formatTime(status.elapsedSeconds)}</strong></p>
                )}
                <p className="status-hint">Your results have been saved and can be viewed in the table below.</p>
              </div>
              <div className="modal-actions">
                <button className="modal-button primary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}

          {status.phase === 'error' && (
            <div className="status-section error">
              <div className="status-header">
                <span className="error-icon">✕</span>
                <h3>Analysis Failed</h3>
              </div>
              <div className="status-details">
                <p className="error-message">{status.errorMessage || 'Unknown error occurred'}</p>
                <p className="status-hint">Partial results (if any) have been saved.</p>
              </div>
              <div className="modal-actions">
                <button className="modal-button primary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
