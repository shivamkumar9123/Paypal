import React, { useEffect, useRef, useState, useMemo } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Filter,
  Lock,
  Unlock,
  RotateCcw,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  DollarSign,
  AlertOctagon,
  ArrowRight,
} from "lucide-react";

const RISK_COLORS = {
  CRITICAL: { background: "#dc2626", border: "#ef4444", highlight: { background: "#ef4444", border: "#fca5a5" } },
  HIGH: { background: "#ea580c", border: "#f97316", highlight: { background: "#f97316", border: "#fdba74" } },
  MEDIUM: { background: "#d97706", border: "#f59e0b", highlight: { background: "#f59e0b", border: "#fde047" } },
  LOW: { background: "#0284c7", border: "#38bdf8", highlight: { background: "#38bdf8", border: "#bae6fd" } },
};

export default function NetworkGraph({
  nodes = [],
  edges = [],
  groups = [],
  selectedGroupId = null,
  onSelectNode,
  onSelectEdge,
  onSelectGroup,
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [minAmount, setMinAmount] = useState(0);
  const [physicsActive, setPhysicsActive] = useState(false);
  const [activeSelection, setActiveSelection] = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");

  // Filter nodes & edges cleanly
  const filteredData = useMemo(() => {
    let visibleNodes = [...nodes];
    let visibleEdges = [...edges];

    // Filter by group if a group is selected
    if (selectedGroupId) {
      const activeGroup = groups.find((g) => g.group_id === selectedGroupId);
      if (activeGroup) {
        const groupAccs = new Set(activeGroup.accounts);
        const groupTxs = new Set(activeGroup.transactions);
        visibleNodes = visibleNodes.filter((n) => groupAccs.has(n.id));
        visibleEdges = visibleEdges.filter((e) => groupTxs.has(e.transaction_id));
      }
    }

    // Filter by Risk Level
    if (filterRisk !== "ALL") {
      visibleNodes = visibleNodes.filter((n) => n.risk_level === filterRisk);
      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
      visibleEdges = visibleEdges.filter(
        (e) => visibleNodeIds.has(e.from_node) && visibleNodeIds.has(e.to_node)
      );
    }

    // Filter by Min Amount
    if (minAmount > 0) {
      visibleEdges = visibleEdges.filter((e) => e.amount >= minAmount);
      // Keep nodes connected to these edges
      const edgeNodes = new Set();
      visibleEdges.forEach((e) => {
        edgeNodes.add(e.from_node);
        edgeNodes.add(e.to_node);
      });
      visibleNodes = visibleNodes.filter((n) => edgeNodes.has(n.id));
    }

    return { visibleNodes, visibleEdges };
  }, [nodes, edges, groups, selectedGroupId, filterRisk, minAmount]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Convert to vis-network format
    const visNodes = new DataSet(
      filteredData.visibleNodes.map((node) => {
        const color = RISK_COLORS[node.risk_level] || RISK_COLORS.LOW;
        const isCriticalOrHigh = node.risk_level === "CRITICAL" || node.risk_level === "HIGH";

        return {
          id: node.id,
          label: node.label,
          color: {
            background: color.background,
            border: color.border,
            highlight: color.highlight,
          },
          font: { color: "#f8fafc", size: 12, face: "Inter, sans-serif" },
          shape: isCriticalOrHigh ? "box" : "dot",
          size: Math.max(16, Math.min(28, 14 + (node.in_degree + node.out_degree) * 1.5)),
          margin: 8,
          borderWidth: 2,
          shadow: false, // disable expensive node shadows for crisp rendering
        };
      })
    );

    const visEdges = new DataSet(
      filteredData.visibleEdges.map((edge) => {
        const isSusp = edge.is_suspicious;
        return {
          id: edge.id,
          from: edge.from_node,
          to: edge.to_node,
          label: `$${edge.amount.toLocaleString()}`,
          arrows: { to: { enabled: true, scaleFactor: 0.7 } },
          color: {
            color: isSusp ? "#ef4444" : "#475569",
            highlight: isSusp ? "#f87171" : "#94a3b8",
            hover: isSusp ? "#fca5a5" : "#cbd5e1",
          },
          width: isSusp ? 2.5 : 1.2,
          dashes: !isSusp,
          font: {
            color: isSusp ? "#fca5a5" : "#94a3b8",
            size: 10,
            align: "middle",
            background: "#090d16",
          },
          smooth: { type: "curvedCW", roundness: 0.15 },
        };
      })
    );

    const options = {
      physics: {
        enabled: true,
        solver: "barnesHut",
        barnesHut: {
          gravitationalConstant: -2500,
          centralGravity: 0.25,
          springLength: 110,
          springConstant: 0.04,
          damping: 0.8,
          avoidOverlap: 0.8,
        },
        stabilization: {
          enabled: true,
          iterations: 150,
          updateInterval: 25,
          fit: true,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 150,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        selectable: true,
        multiselect: false,
        navigationButtons: false,
      },
    };

    const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
    networkRef.current = network;

    // Once layout stabilizes, FREEZE physics so nodes stay stationary and predictable
    network.once("stabilizationIterationsDone", () => {
      network.setOptions({ physics: { enabled: false } });
      setPhysicsActive(false);
      network.fit({ animation: { duration: 400 } });
    });

    network.on("selectNode", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const nodeObj = nodes.find((n) => n.id === nodeId);
        setActiveSelection({ type: "node", data: nodeObj });
        if (onSelectNode) onSelectNode(nodeObj);
      }
    });

    network.on("selectEdge", (params) => {
      if (params.edges.length > 0 && params.nodes.length === 0) {
        const edgeId = params.edges[0];
        const edgeObj = edges.find((e) => e.id === edgeId);
        setActiveSelection({ type: "edge", data: edgeObj });
        if (onSelectEdge) onSelectEdge(edgeObj);
      }
    });

    network.on("click", (params) => {
      if (params.nodes.length === 0 && params.edges.length === 0) {
        setActiveSelection(null);
      }
    });

    return () => {
      network.destroy();
    };
  }, [filteredData]);

  // Handle Search & Focus
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !networkRef.current) return;
    const query = searchQuery.trim().toLowerCase();
    const match = nodes.find((n) => n.id.toLowerCase() === query || n.label.toLowerCase() === query);

    if (match) {
      setSearchFeedback("");
      networkRef.current.focus(match.id, {
        scale: 1.3,
        animation: { duration: 600, easingFunction: "easeInOutQuad" },
      });
      networkRef.current.selectNodes([match.id]);
      setActiveSelection({ type: "node", data: match });
      if (onSelectNode) onSelectNode(match);
    } else {
      setSearchFeedback(`Account "${searchQuery}" not found.`);
      setTimeout(() => setSearchFeedback(""), 3000);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchFeedback("");
    if (networkRef.current) {
      networkRef.current.unselectAll();
      networkRef.current.fit({ animation: { duration: 400 } });
    }
    setActiveSelection(null);
  };

  const handleZoomIn = () => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale * 1.35, animation: { duration: 250 } });
  };

  const handleZoomOut = () => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale / 1.35, animation: { duration: 250 } });
  };

  const handleFit = () => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: { duration: 400 } });
  };

  const handleReLayout = () => {
    if (!networkRef.current) return;
    networkRef.current.setOptions({ physics: { enabled: true } });
    setPhysicsActive(true);
    networkRef.current.stabilize(150);
    networkRef.current.once("stabilizationIterationsDone", () => {
      networkRef.current.setOptions({ physics: { enabled: false } });
      setPhysicsActive(false);
      networkRef.current.fit({ animation: { duration: 400 } });
    });
  };

  const togglePhysics = () => {
    if (!networkRef.current) return;
    const nextState = !physicsActive;
    networkRef.current.setOptions({ physics: { enabled: nextState } });
    setPhysicsActive(nextState);
  };

  const resetAllFilters = () => {
    setFilterRisk("ALL");
    setMinAmount(0);
    setSearchQuery("");
    if (onSelectGroup) onSelectGroup(null);
    if (networkRef.current) {
      networkRef.current.fit({ animation: { duration: 400 } });
    }
  };

  return (
    <div className="network-section-container">
      {/* Structured, Clean Controls Toolbar */}
      <div className="clean-toolbar">
        {/* Row 1: Primary Search & Group Selector */}
        <div className="toolbar-row primary-controls">
          <form className="search-bar-clean" onSubmit={handleSearch}>
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search account (e.g. ACC_ALPHA_1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="clear-search-btn" title="Clear search">
                <X size={14} />
              </button>
            )}
            <button type="submit" className="search-submit-btn">Find & Focus</button>
          </form>

          {/* Group Selector Dropdown */}
          <div className="group-dropdown-wrapper">
            <label className="dropdown-label"><Layers size={14} /> Focus Group:</label>
            <select
              value={selectedGroupId || "ALL"}
              onChange={(e) => {
                const val = e.target.value;
                onSelectGroup(val === "ALL" ? null : val);
              }}
              className="group-select"
            >
              <option value="ALL">All Network Groups ({groups.length} detected)</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_id} — {g.risk_level} ({Math.round(g.risk_score)} pts)
                </option>
              ))}
            </select>
          </div>

          {(selectedGroupId || filterRisk !== "ALL" || minAmount > 0) && (
            <button onClick={resetAllFilters} className="btn-reset-filters" title="Reset all filters">
              <RotateCcw size={13} /> Reset Filters
            </button>
          )}
        </div>

        {/* Row 2: Secondary Filters (Risk Chips & Amount) */}
        <div className="toolbar-row secondary-controls">
          <div className="chip-filter-group">
            <span className="filter-title"><Filter size={13} /> Risk Level:</span>
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => (
              <button
                key={level}
                type="button"
                className={`filter-chip ${filterRisk === level ? "active" : ""} chip-${level.toLowerCase()}`}
                onClick={() => setFilterRisk(level)}
              >
                {level === "ALL" ? "All Levels" : level}
              </button>
            ))}
          </div>

          <div className="amount-filter-clean">
            <DollarSign size={14} className="text-muted" />
            <span>Min Amount:</span>
            <input
              type="number"
              min="0"
              step="500"
              value={minAmount}
              onChange={(e) => setMinAmount(Math.max(0, Number(e.target.value)))}
              className="amount-input"
              placeholder="0"
            />
          </div>

          <div className="visible-count-label">
            Showing <strong>{filteredData.visibleNodes.length}</strong> nodes / <strong>{filteredData.visibleEdges.length}</strong> transfers
          </div>
        </div>

        {searchFeedback && (
          <div className="search-feedback-banner">
            <AlertOctagon size={14} /> {searchFeedback}
          </div>
        )}
      </div>

      {/* Main Layout Area: Canvas on left, Docked Inspector on right */}
      <div className="canvas-dock-layout">
        {/* Canvas Area */}
        <div className="canvas-main-area">
          <div ref={containerRef} className="vis-canvas" />

          {/* Floating Navigation Controls (Clean, grouped, semi-transparent) */}
          <div className="floating-nav-dock">
            <button onClick={handleZoomIn} title="Zoom In" className="nav-dock-btn">
              <ZoomIn size={16} />
            </button>
            <button onClick={handleZoomOut} title="Zoom Out" className="nav-dock-btn">
              <ZoomOut size={16} />
            </button>
            <div className="nav-dock-divider" />
            <button onClick={handleFit} title="Fit to Screen" className="nav-dock-btn">
              <Maximize2 size={16} />
            </button>
            <button onClick={handleReLayout} title="Auto-rearrange Layout" className="nav-dock-btn">
              <RotateCcw size={16} />
            </button>
            <button
              onClick={togglePhysics}
              title={physicsActive ? "Physics is Active (Click to Lock/Freeze)" : "Physics is Frozen (Click to Relax)"}
              className={`nav-dock-btn ${physicsActive ? "active-physics" : ""}`}
            >
              {physicsActive ? <Unlock size={16} /> : <Lock size={16} />}
            </button>
          </div>

          {/* Minimal Collapsible Legend at Bottom-Left */}
          <div className="collapsible-legend-dock">
            <button
              type="button"
              className="legend-toggle-btn"
              onClick={() => setShowLegend(!showLegend)}
            >
              <span>Graph Legend</span>
              {showLegend ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {showLegend && (
              <div className="legend-expanded-content">
                <div className="legend-row">
                  <span className="dot dot-critical" /> <span>Critical Risk ({">="} 80 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-high" /> <span>High Risk (60–79 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-medium" /> <span>Medium Risk (35–59 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-low" /> <span>Low / Legitimate (0–34 pts)</span>
                </div>
                <div className="legend-divider" />
                <div className="legend-row">
                  <span className="line-suspicious" /> <span>Suspicious Ring Transfer</span>
                </div>
                <div className="legend-row">
                  <span className="line-normal" /> <span>Standard Payment</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Docked Inspector Panel (Right side, non-overlapping) */}
        {activeSelection && (
          <aside className="docked-inspector-panel">
            <div className="inspector-top-bar">
              <h4>{activeSelection.type === "node" ? "Account Inspector" : "Transfer Inspector"}</h4>
              <button onClick={() => setActiveSelection(null)} className="close-dock-btn" title="Close Panel">
                <X size={16} />
              </button>
            </div>

            <div className="inspector-content">
              {activeSelection.type === "node" ? (
                <>
                  <div className="inspector-id-block">
                    <span className="inspector-label">Account Identifier</span>
                    <strong className="mono inspector-account-id">{activeSelection.data.id}</strong>
                  </div>

                  <div className="inspector-stat-grid">
                    <div className="stat-tile">
                      <span className="stat-label">Risk Level</span>
                      <span className={`badge badge-${activeSelection.data.risk_level.toLowerCase()}`}>
                        {activeSelection.data.risk_level}
                      </span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-label">Connections</span>
                      <span className="stat-value">{activeSelection.data.in_degree + activeSelection.data.out_degree} transfers</span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-label">Total Inflow</span>
                      <span className="stat-value text-success">${activeSelection.data.total_inflow.toLocaleString()}</span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-label">Total Outflow</span>
                      <span className="stat-value text-warning">${activeSelection.data.total_outflow.toLocaleString()}</span>
                    </div>
                  </div>

                  {activeSelection.data.group_ids && activeSelection.data.group_ids.length > 0 && (
                    <div className="inspector-groups-section">
                      <span className="inspector-label">Linked Fraud Rings</span>
                      <div className="groups-button-list">
                        {activeSelection.data.group_ids.map((gid) => (
                          <button
                            key={gid}
                            className="group-link-btn"
                            onClick={() => onSelectGroup(gid)}
                          >
                            <span>{gid}</span>
                            <ArrowRight size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="inspector-id-block">
                    <span className="inspector-label">Transaction ID</span>
                    <strong className="mono inspector-account-id">{activeSelection.data.transaction_id}</strong>
                  </div>

                  <div className="inspector-flow-card">
                    <div className="flow-node">
                      <span className="flow-role">Origin (Sender)</span>
                      <strong className="mono">{activeSelection.data.from_node}</strong>
                    </div>
                    <div className="flow-arrow">&darr;</div>
                    <div className="flow-node">
                      <span className="flow-role">Destination (Receiver)</span>
                      <strong className="mono">{activeSelection.data.to_node}</strong>
                    </div>
                  </div>

                  <div className="inspector-stat-grid">
                    <div className="stat-tile">
                      <span className="stat-label">Amount Transferred</span>
                      <span className="stat-value text-highlight font-semibold">
                        ${activeSelection.data.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-label">Detection Status</span>
                      <span className={activeSelection.data.is_suspicious ? "badge badge-critical" : "badge badge-low"}>
                        {activeSelection.data.is_suspicious ? "SUSPICIOUS" : "STANDARD"}
                      </span>
                    </div>
                  </div>

                  <div className="timestamp-tile">
                    <span className="stat-label">Timestamp</span>
                    <span className="mono text-sm">{activeSelection.data.timestamp}</span>
                  </div>

                  {activeSelection.data.group_ids && activeSelection.data.group_ids.length > 0 && (
                    <div className="inspector-groups-section">
                      <span className="inspector-label">Associated Ring</span>
                      <button
                        className="group-link-btn"
                        onClick={() => onSelectGroup(activeSelection.data.group_ids[0])}
                      >
                        <span>{activeSelection.data.group_ids[0]}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
