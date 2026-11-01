import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Network,
  Users,
  Search,
  FileSpreadsheet,
  CreditCard,
  RefreshCw,
  Upload,
  CheckCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

import { checkHealth, loadSampleData, runAnalysis, updateGroupStatus } from "./services/api";
import NetworkGraph from "./components/NetworkGraph";
import GroupDetailPanel from "./components/GroupDetailPanel";
import TransactionExplorer from "./components/TransactionExplorer";
import CsvUploadModal from "./components/CsvUploadModal";
import PayPalSandboxPortal from "./components/PayPalSandboxPortal";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = useState("graph"); // "graph", "groups", "investigation", "transactions", "paypal"
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [summary, setSummary] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [notification, setNotification] = useState("");

  // Load initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      await checkHealth();
      setBackendOnline(true);

      const res = await runAnalysis();
      setSummary(res.summary);
      setNodes(res.nodes);
      setEdges(res.edges);
      setGroups(res.groups);

      if (res.groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(res.groups[0].group_id);
      }
    } catch (err) {
      setBackendOnline(false);
      setErrorMessage("Could not connect to FastAPI backend at http://127.0.0.1:8000. Ensure server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLoadSample = async () => {
    try {
      setLoading(true);
      const res = await loadSampleData();
      setSummary(res.summary);
      setNodes(res.nodes);
      setEdges(res.edges);
      setGroups(res.groups);
      if (res.groups.length > 0) {
        setSelectedGroupId(res.groups[0].group_id);
      }
      showNotification("Bundled synthetic dataset loaded successfully.");
    } catch (err) {
      setErrorMessage("Failed to load sample dataset: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  const handleStatusUpdate = async (groupId, payload) => {
    const updated = await updateGroupStatus(groupId, payload);
    // Update local state
    setGroups((prev) =>
      prev.map((g) => (g.group_id === groupId ? { ...g, ...updated } : g))
    );
    showNotification(`Status for ${groupId} updated to ${payload.status}`);
  };

  const activeGroup = groups.find((g) => g.group_id === selectedGroupId) || groups[0];

  // Reconstruct flat transactions list from edges
  const flatTransactions = edges.map((e) => ({
    transaction_id: e.transaction_id,
    sender_id: e.from_node,
    receiver_id: e.to_node,
    amount: e.amount,
    timestamp: e.timestamp,
  }));

  return (
    <div className="fraudring-app">
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">
            <ShieldAlert size={26} className="text-highlight" />
          </div>
          <div>
            <div className="flex-align-gap">
              <h1>FraudRing AI</h1>
              <span className="version-pill">v1.0 Hackathon MVP</span>
            </div>
            <p className="tagline">Detecting the connections behind payment fraud.</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="backend-status-badge">
            <span className={`status-dot ${backendOnline ? "status-dot-online" : "status-dot-offline"}`} />
            <span>{backendOnline ? "API Online (Port 8000)" : "API Disconnected"}</span>
          </div>

          <button onClick={handleLoadSample} disabled={loading} className="btn-secondary">
            <RefreshCw size={15} /> Load Sample Data
          </button>

          <button onClick={() => setIsCsvModalOpen(true)} className="btn-secondary">
            <Upload size={15} /> Upload CSV
          </button>

          <button onClick={fetchData} disabled={loading} className="btn-primary">
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Run Analysis
          </button>
        </div>
      </header>

      {/* Global Notifications */}
      {notification && (
        <div className="toast-notification">
          <CheckCircle size={16} /> {notification}
        </div>
      )}

      {errorMessage && (
        <div className="global-error-banner">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
          <button onClick={fetchData} className="btn-secondary btn-sm">Retry</button>
        </div>
      )}

      {/* Overview Metrics Bar */}
      {summary && (
        <section className="metrics-strip">
          <div className="metric-card">
            <span className="metric-label">Transactions Analyzed</span>
            <strong className="metric-value">{summary.total_transactions}</strong>
            <span className="metric-sub">Across full directed network</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Unique Accounts</span>
            <strong className="metric-value">{summary.total_accounts}</strong>
            <span className="metric-sub">Senders & Receivers</span>
          </div>
          <div className="metric-card card-accent-critical">
            <span className="metric-label">Suspicious Groups Flagged</span>
            <strong className="metric-value">{summary.suspicious_groups_count}</strong>
            <span className="metric-sub">{summary.high_or_critical_groups_count} Critical / High Risk</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Flagged Transactions</span>
            <strong className="metric-value">{summary.suspicious_transactions_count}</strong>
            <span className="metric-sub">${summary.total_suspicious_volume.toLocaleString()} volume at risk</span>
          </div>
          <div className="metric-card card-accent-warning">
            <span className="metric-label">Awaiting Review</span>
            <strong className="metric-value">{summary.groups_awaiting_review}</strong>
            <span className="metric-sub">Active workflow items</span>
          </div>
        </section>
      )}

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveTab("graph")}
        >
          <Network size={16} /> Network Graph ({nodes.length} nodes)
        </button>

        <button
          className={`tab-btn ${activeTab === "groups" ? "active" : ""}`}
          onClick={() => setActiveTab("groups")}
        >
          <Users size={16} /> Suspicious Groups ({groups.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "investigation" ? "active" : ""}`}
          onClick={() => setActiveTab("investigation")}
        >
          <Layers size={16} /> Deep Investigation {activeGroup ? `(${activeGroup.group_id})` : ""}
        </button>

        <button
          className={`tab-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <Search size={16} /> Transaction Explorer ({flatTransactions.length})
        </button>

        <button
          className={`tab-btn ${activeTab === "paypal" ? "active" : ""}`}
          onClick={() => setActiveTab("paypal")}
        >
          <CreditCard size={16} /> PayPal Sandbox Portal
        </button>
      </nav>

      {/* Main Tab Content */}
      <main className="tab-viewport">
        {loading && !summary ? (
          <div className="loading-state">
            <RefreshCw size={36} className="spin text-highlight" />
            <h3>Analyzing Payment Network...</h3>
            <p>Evaluating circular loops, rapid transfers, smurfing concentration, and multi-hop paths.</p>
          </div>
        ) : (
          <>
            {activeTab === "graph" && (
              <NetworkGraph
                nodes={nodes}
                edges={edges}
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={(gid) => {
                  setSelectedGroupId(gid);
                  if (gid) setActiveTab("investigation");
                }}
                onSelectNode={(node) => {
                  if (node && node.group_ids && node.group_ids.length > 0) {
                    setSelectedGroupId(node.group_ids[0]);
                  }
                }}
              />
            )}

            {activeTab === "groups" && (
              <div className="groups-tab-content">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Group ID</th>
                        <th>Risk Level</th>
                        <th>Risk Score</th>
                        <th>Primary Detected Patterns</th>
                        <th>Accounts</th>
                        <th>Transactions</th>
                        <th>Total Volume</th>
                        <th>Workflow Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.group_id} className={selectedGroupId === g.group_id ? "row-selected" : ""}>
                          <td className="mono font-semibold">{g.group_id}</td>
                          <td>
                            <span className={`badge badge-${g.risk_level.toLowerCase()}`}>
                              {g.risk_level}
                            </span>
                          </td>
                          <td>
                            <div className="score-mini-bar">
                              <strong>{Math.round(g.risk_score)}</strong>
                              <div className="bar-track">
                                <div
                                  className={`bar-fill fill-${g.risk_level.toLowerCase()}`}
                                  style={{ width: `${g.risk_score}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="pills-wrap">
                              {g.patterns.map((p, idx) => (
                                <span key={idx} className="pattern-pill">
                                  {p.title}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>{g.accounts.length} accounts</td>
                          <td>{g.transactions.length} txs</td>
                          <td className="text-highlight font-semibold">${g.total_volume.toLocaleString()}</td>
                          <td>
                            <span className="status-badge-inline">{g.status}</span>
                          </td>
                          <td>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => {
                                setSelectedGroupId(g.group_id);
                                setActiveTab("investigation");
                              }}
                            >
                              Investigate <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "investigation" && (
              <GroupDetailPanel
                group={activeGroup}
                transactions={flatTransactions}
                onUpdateStatus={handleStatusUpdate}
                onFocusGroupInGraph={(gid) => {
                  setSelectedGroupId(gid);
                  setActiveTab("graph");
                }}
              />
            )}

            {activeTab === "transactions" && (
              <TransactionExplorer
                transactions={flatTransactions}
                groups={groups}
                onSelectGroup={(gid) => {
                  setSelectedGroupId(gid);
                  setActiveTab("investigation");
                }}
              />
            )}

            {activeTab === "paypal" && <PayPalSandboxPortal />}
          </>
        )}
      </main>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onUploadSuccess={() => {
          setIsCsvModalOpen(false);
          fetchData();
          showNotification("CSV dataset uploaded and analyzed successfully.");
        }}
      />
    </div>
  );
}