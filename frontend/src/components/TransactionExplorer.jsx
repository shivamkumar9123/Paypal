import React, { useState, useMemo } from "react";
import { Search, Filter, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";

export default function TransactionExplorer({
  transactions = [],
  groups = [],
  onSelectGroup,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, FLAGGED, LEGITIMATE

  // Build a lookup of transaction_id -> group_ids
  const txGroupMap = useMemo(() => {
    const map = {};
    for (const g of groups) {
      for (const txId of g.transactions) {
        if (!map[txId]) map[txId] = [];
        map[txId].push(g);
      }
    }
    return map;
  }, [groups]);

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      const isFlagged = Boolean(txGroupMap[tx.transaction_id]);
      if (filterType === "FLAGGED" && !isFlagged) return false;
      if (filterType === "LEGITIMATE" && isFlagged) return false;

      if (!term) return true;
      return (
        tx.transaction_id.toLowerCase().includes(term) ||
        tx.sender_id.toLowerCase().includes(term) ||
        tx.receiver_id.toLowerCase().includes(term)
      );
    });
  }, [transactions, txGroupMap, searchTerm, filterType]);

  return (
    <div className="transaction-explorer">
      {/* Explorer Toolbar */}
      <div className="explorer-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by transaction ID, sender, or receiver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label><Filter size={14} /> Filter Status:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">All Transactions ({transactions.length})</option>
            <option value="FLAGGED">Flagged by FraudRing ({Object.keys(txGroupMap).length})</option>
            <option value="LEGITIMATE">Legitimate / Non-Flagged</option>
          </select>
        </div>

        <span className="results-counter text-sm text-muted">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Transactions Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Timestamp</th>
              <th>Sender Account</th>
              <th>Receiver Account</th>
              <th>Amount ($)</th>
              <th>Graph Risk Status</th>
              <th>Associated Groups</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => {
              const matchedGroups = txGroupMap[tx.transaction_id] || [];
              const isFlagged = matchedGroups.length > 0;
              const maxRisk = matchedGroups.reduce((acc, g) => {
                if (g.risk_level === "CRITICAL") return "CRITICAL";
                if (g.risk_level === "HIGH" && acc !== "CRITICAL") return "HIGH";
                if (g.risk_level === "MEDIUM" && !["CRITICAL", "HIGH"].includes(acc)) return "MEDIUM";
                return acc;
              }, "LOW");

              return (
                <tr key={tx.transaction_id} className={isFlagged ? "row-flagged" : ""}>
                  <td className="mono font-semibold">{tx.transaction_id}</td>
                  <td className="mono text-sm">{tx.timestamp}</td>
                  <td className="mono">{tx.sender_id}</td>
                  <td className="mono">{tx.receiver_id}</td>
                  <td className="font-semibold text-highlight">${tx.amount.toLocaleString()}</td>
                  <td>
                    {isFlagged ? (
                      <span className={`badge badge-${maxRisk.toLowerCase()}`}>
                        FLAGGED ({maxRisk})
                      </span>
                    ) : (
                      <span className="badge badge-low">LEGITIMATE</span>
                    )}
                  </td>
                  <td>
                    {matchedGroups.map((g) => (
                      <button
                        key={g.group_id}
                        className="pill-btn"
                        onClick={() => onSelectGroup(g.group_id)}
                        title={`View ${g.group_id}`}
                      >
                        {g.group_id} &rarr;
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
