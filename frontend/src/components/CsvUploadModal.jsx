import React, { useState } from "react";
import { UploadCloud, AlertCircle, CheckCircle, FileText, X } from "lucide-react";
import { uploadCsvFile } from "../services/api";

export default function CsvUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setResult(null);
      const res = await uploadCsvFile(file);
      setResult(res);
      if (res.success) {
        if (onUploadSuccess) onUploadSuccess();
      }
    } catch (err) {
      setResult({
        success: false,
        message: err.message,
        errors: [{ message: err.message }],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-align-gap">
            <UploadCloud size={22} className="text-highlight" />
            <h2>Upload Transaction Dataset</h2>
          </div>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm">
            Import a transaction CSV with headers:{" "}
            <code className="mono">transaction_id, sender_id, receiver_id, amount, timestamp</code>
          </p>

          <div
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FileText size={36} className="text-muted" />
            <p>Drag and drop your transaction CSV here, or</p>
            <label className="btn-secondary btn-sm file-input-label">
              Browse Files
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: "none" }} />
            </label>
            {file && <span className="selected-filename">Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>}
          </div>

          {result && (
            <div className={`upload-result-box ${result.success ? "result-success" : "result-error"}`}>
              <div className="flex-align-gap">
                {result.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <strong>{result.message}</strong>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="validation-error-list">
                  <h4>Validation Errors ({result.errors.length}):</h4>
                  <ul>
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>
                        {err.row && <strong>Row {err.row}: </strong>}
                        {err.field && <em>[{err.field}] </em>}
                        {err.message}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-muted">...and {result.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary"
          >
            {uploading ? "Validating & Uploading..." : "Upload & Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
