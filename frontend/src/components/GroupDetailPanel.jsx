import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  FileText,
  UserCheck,
  Send,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

export default function GroupDetailPanel({
  group,
  transactions = [],
  onUpdateStatus,
  onFocusGroupInGraph,
}) {
  const [selectedStatus, setSelectedStatus] = useState(group.status || "NEW");
  const [notes, setNotes] = useState(group.notes || "");
  const [assignedTo, setAssignedTo] = useState(group.assigned_to || "Fraud Analyst");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  if (!group) {
    return (
      <div className="empty-panel">
        <HelpCircle size={40} className="text-muted" />
        <h3>No Suspicious Group Selected</h3>
        <p>Select a group from the list or click a node on the graph to view deep investigative evidence.</p>
      </div>
    );
  }

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveMessage("");
      await onUpdateStatus(group.group_id, {
        status: selectedStatus,
        notes,
        assigned_to: assignedTo,
      });
      setSaveMessage("Investigation status & notes saved to SQLite.");
      setTimeout(() => setSaveMessage(""), 4000);
    } catch (err) {
      setSaveMessage("Failed to save status: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Find transaction objects in this group
  const groupTxObjects = transactions
    .filter((tx) => group.transactions.includes(tx.transaction_id))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="group-detail-panel">
      {/* Group Header Card */}
      <div className="group-header-card">
        <div className="group-title-row">
          <div>
            <div className="flex-align-gap">
              <span className="mono group-title-badge">{group.group_id}</span>
              <span className={`badge badge-${group.risk_level.toLowerCase()}`}>
                {group.risk_level} RISK
              </span>
              <span className="text-muted text-sm">Status: <strong>{group.status}</strong></span>
            </div>
            <h2>Coordinated Network Investigation</h2>
          </div>

          <div className="risk-score-display">
            <div className="score-circle">
              <span className="score-num">{Math.round(group.risk_score)}</span>
              <span className="score-label">/ 100</span>
            </div>
            <button
              onClick={() => onFocusGroupInGraph(group.group_id)}
              className="btn-secondary btn-sm"
            >
              <ExternalLink size={14} /> Focus on Graph
            </button>
          </div>
        </div>

        {/* Status Workflow Action Form */}
        <form className="status-update-form" onSubmit={handleSaveStatus}>
          <div className="status-field">
            <label>Investigation Workflow:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="status-select"
            >
              <option value="NEW">NEW</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          <div className="status-field">
            <label>Assigned Investigator:</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="assigned-input"
            />
          </div>

          <div className="status-field notes-field">
            <label>Analyst Notes:</label>
            <input
              type="text"
              placeholder="Add investigative findings, IP checks, or SAR filing notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="notes-input"
            />
          </div>

          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving..." : "Update Status"}
          </button>
        </form>

        {saveMessage && (
          <div className={`status-alert ${saveMessage.includes('Failed') ? 'status-alert-error' : 'status-alert-success'}`}>
            <CheckCircle2 size={16} /> {saveMessage}
          </div>
        )}
      </div>

      {/* Narrative Section */}
      <div className="panel-section">
        <div className="section-title">
          <FileText size={18} className="text-highlight" />
          <h3>Explainable Alert Narrative</h3>
        </div>
        <div className="narrative-card">
          <p>{group.summary_narrative}</p>
        </div>
      </div>

      {/* Heuristic Score Breakdown */}
      <div className="panel-section">
        <div className="section-title">
          <ShieldAlert size={18} className="text-warning" />
          <h3>Risk Score Composition & Heuristic Breakdown</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Detection Signal</th>
                <th>Points Added</th>
                <th>Underlying Rationale</th>
              </tr>
            </thead>
            <tbody>
              {group.score_breakdown.map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.signal_name}</strong></td>
                  <td><span className="points-badge">+{item.points}</span></td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chronological Transfer Sequence */}
      <div className="panel-section">
        <div className="section-title">
          <Clock size={18} className="text-highlight" />
          <h3>Chronological Transfer Sequence</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Timestamp</th>
                <th>Origin Sender</th>
                <th>Destination Receiver</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupTxObjects.map((tx, idx) => (
                <tr key={tx.transaction_id}>
                  <td className="mono font-semibold">{tx.transaction_id}</td>
                  <td className="mono text-sm">{tx.timestamp}</td>
                  <td className="mono">{tx.sender_id}</td>
                  <td className="mono">{tx.receiver_id}</td>
                  <td className="font-semibold text-highlight">${tx.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connected Accounts Involved */}
      <div className="panel-section">
        <div className="section-title">
          <UserCheck size={18} className="text-highlight" />
          <h3>Connected Accounts in Network ({group.accounts.length})</h3>
        </div>
        <div className="accounts-pill-grid">
          {group.accounts.map((acc) => (
            <div key={acc} className="account-tag-card">
              <span className="mono">{acc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Next Steps */}
      <div className="panel-section">
        <div className="section-title">
          <AlertTriangle size={18} className="text-warning" />
          <h3>Recommended Investigative Actions</h3>
        </div>
        <div className="checklist-container">
          {group.suggested_steps.map((step, idx) => (
            <div key={idx} className="checklist-item">
              <span className="step-num">{idx + 1}</span>
              <p>{step.replace(/^\d+\.\s*/, "")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
