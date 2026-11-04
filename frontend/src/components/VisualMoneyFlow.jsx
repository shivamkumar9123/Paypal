import React, { useState, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Clock,
  DollarSign,
  AlertTriangle,
  User,
  CheckCircle2,
} from "lucide-react";

export default function VisualMoneyFlow({ group, transactions = [], onSelectAccount }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Filter and sort transactions for this group in chronological order
  const groupTransactions = useMemo(() => {
    if (!group || !group.transactions) return [];
    const txMap = new Map(transactions.map((t) => [t.transaction_id, t]));
    return group.transactions
      .map((id) => txMap.get(id))
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [group, transactions]);

  // Primary pattern detected
  const primaryPattern = useMemo(() => {
    if (!group || !group.patterns || group.patterns.length === 0) return null;
    return group.patterns[0];
  }, [group]);

  // Reset step index when group changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [group?.group_id]);

  // Auto-play interval
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= groupTransactions.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, groupTransactions.length]);

  if (!group || groupTransactions.length === 0) {
    return (
      <div className="empty-flow-box">
        <p>No transaction sequence found for this group.</p>
      </div>
    );
  }

  const activeTx = groupTransactions[currentStepIndex];

  // Calculate time delta from previous transaction
  const getDeltaString = (idx) => {
    if (idx === 0) return "Initial Transfer";
    const prevTime = new Date(groupTransactions[idx - 1].timestamp).getTime();
    const currTime = new Date(groupTransactions[idx].timestamp).getTime();
    const diffSec = Math.max(0, Math.round((currTime - prevTime) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `+${secs}s later`;
    return `+${mins}m ${secs}s later`;
  };

  return (
    <div className="money-flow-container">
      {/* Visual Flow Header & Simple Playback Controls */}
      <div className="flow-playback-toolbar">
        <div className="playback-info">
          <span className="step-badge">
            Transfer Step {currentStepIndex + 1} of {groupTransactions.length}
          </span>
          <span className="delta-badge">{getDeltaString(currentStepIndex)}</span>
        </div>

        <div className="simple-controls-cluster">
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(0);
            }}
            title="Reset to Step 1"
            className="ctrl-btn"
          >
            <RotateCcw size={15} /> Reset
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentStepIndex === 0}
            className="ctrl-btn"
            title="Previous Transfer"
          >
            <SkipBack size={15} /> Prev
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`ctrl-btn btn-play-highlight ${isPlaying ? "playing" : ""}`}
            title={isPlaying ? "Pause Flow" : "Auto-Play Sequence"}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? "Pause" : "Play Flow"}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.min(groupTransactions.length - 1, prev + 1));
            }}
            disabled={currentStepIndex === groupTransactions.length - 1}
            className="ctrl-btn"
            title="Next Transfer"
          >
            Next <SkipForward size={15} />
          </button>
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="flow-step-progress-bar">
        {groupTransactions.map((tx, idx) => (
          <button
            key={tx.transaction_id}
            type="button"
            className={`step-tick ${idx <= currentStepIndex ? "active" : ""} ${idx === currentStepIndex ? "current" : ""}`}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(idx);
            }}
          >
            <span className="tick-number">{idx + 1}</span>
            <span className="tick-amount">${Math.round(tx.amount).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Live Transfer Spotlight Card */}
      {activeTx && (
        <div className="transfer-spotlight-card">
          <div className="spotlight-header">
            <span className="spotlight-title">Active Transfer Spotlight</span>
            <span className="mono spotlight-tx-id">{activeTx.transaction_id}</span>
          </div>

          <div className="flow-stages-visual">
            {/* Sender Account Card */}
            <div
              className="account-flow-node sender-node"
              onClick={() => onSelectAccount && onSelectAccount(activeTx.sender_id)}
            >
              <div className="node-icon"><User size={18} /></div>
              <span className="node-role-label">Sender / Origin</span>
              <strong className="mono node-id">{activeTx.sender_id}</strong>
            </div>

            {/* Transfer Pipe / Arrow */}
            <div className="flow-pipe-bridge">
              <div className="pipe-line animated-pulse" />
              <div className="pipe-badge">
                <span className="transfer-amount">${activeTx.amount.toLocaleString()}</span>
                <span className="transfer-time">{new Date(activeTx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <ArrowRight size={22} className="pipe-arrow text-critical" />
            </div>

            {/* Receiver Account Card */}
            <div
              className="account-flow-node receiver-node"
              onClick={() => onSelectAccount && onSelectAccount(activeTx.receiver_id)}
            >
              <div className="node-icon"><User size={18} /></div>
              <span className="node-role-label">Receiver / Beneficiary</span>
              <strong className="mono node-id">{activeTx.receiver_id}</strong>
            </div>
          </div>

          {/* Context Explanation of Current Step */}
          <div className="step-explanation-box">
            <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            <p>
              <strong>Step {currentStepIndex + 1}: </strong>
              Account <span className="mono text-highlight">{activeTx.sender_id}</span> transferred{" "}
              <strong className="text-highlight">${activeTx.amount.toLocaleString()}</strong> to{" "}
              <span className="mono text-highlight">{activeTx.receiver_id}</span>.{" "}
              {currentStepIndex > 0 ? (
                <>This transfer was executed <strong>{getDeltaString(currentStepIndex)}</strong> after the previous hop.</>
              ) : (
                <>This marks the initial trigger transfer initiating the suspicious sequence.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Complete Sequential Pipeline Overview (All steps clearly laid out) */}
      <div className="complete-pipeline-overview">
        <h4>All Transfers in this Coordinated Network ({groupTransactions.length} Hops)</h4>
        <div className="pipeline-steps-list">
          {groupTransactions.map((tx, idx) => {
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={tx.transaction_id}
                className={`pipeline-row ${isCurrent ? "pipeline-row-active" : ""}`}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex(idx);
                }}
              >
                <div className="step-seq-pill">{idx + 1}</div>
                <div className="pipeline-time mono text-muted">
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="pipeline-parties">
                  <span className="mono sender-tag">{tx.sender_id}</span>
                  <ArrowRight size={14} className="text-muted" />
                  <span className="mono receiver-tag">{tx.receiver_id}</span>
                </div>
                <div className="pipeline-amount">
                  ${tx.amount.toLocaleString()}
                </div>
                <div className="pipeline-delta text-muted">
                  {getDeltaString(idx)}
                </div>
                {isCurrent && <span className="now-viewing-badge">Active</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
