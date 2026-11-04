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
  DollarSign,
  AlertOctagon,
  ArrowRight,
  Maximize,
  Minimize,
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
  isExpanded = false,
  onToggleExpand,
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

    // Convert to vis-network format with generous font & spacing
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
          font: { color: "#ffffff", size: 13, face: "Inter, sans-serif", bold: "600" },
          shape: isCriticalOrHigh ? "box" : "dot",
          size: Math.max(22, Math.min(34, 18 + (node.in_degree + node.out_degree) * 2)),
          margin: { top: 10, bottom: 10, left: 14, right: 14 },
          borderWidth: 2,
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
          arrows: { to: { enabled: true, scaleFactor: 0.9 } },
          color: {
            color: isSusp ? "#ef4444" : "#475569",
            highlight: isSusp ? "#f87171" : "#94a3b8",
            hover: isSusp ? "#fca5a5" : "#cbd5e1",
          },
          width: isSusp ? 2.8 : 1.4,
          dashes: !isSusp,
          font: {
            color: isSusp ? "#fca5a5" : "#94a3b8",
            size: 11,
            face: "Inter, sans-serif",
            align: "middle",
            background: "#090d16",
            strokeWidth: 2,
            strokeColor: "#090d16",
          },
          smooth: { type: "curvedCW", roundness: 0.18 },
        };
      })
    );

    const isSmallCluster = filteredData.visibleNodes.length <= 8;

    const options = {
      physics: {
        enabled: true,
        solver: "barnesHut",
        barnesHut: {
          gravitationalConstant: isSmallCluster ? -4500 : -3000,
          centralGravity: isSmallCluster ? 0.05 : 0.15,
          springLength: isSmallCluster ? 220 : 160,
          springConstant: 0.04,
          damping: 0.85,
          avoidOverlap: 0.9,
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

    // Once layout stabilizes, FREEZE physics so nodes stay stationary and auto-fit comfortably
    network.once("stabilizationIterationsDone", () => {
      network.setOptions({ physics: { enabled: false } });
      setPhysicsActive(false);
      network.fit({
        nodes: filteredData.visibleNodes.map((n) => n.id),
        padding: 50,
        animation: { duration: 350 },
      });
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
        scale: 1.25,
        animation: { duration: 500, easingFunction: "easeInOutQuad" },
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
      networkRef.current.fit({ padding: 50, animation: { duration: 350 } });
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
    networkRef.current.fit({ padding: 50, animation: { duration: 350 } });
  };

  const handleReLayout = () => {
    if (!networkRef.current) return;
    networkRef.current.setOptions({ physics: { enabled: true } });
    setPhysicsActive(true);
    networkRef.current.stabilize(150);
    networkRef.current.once("stabilizationIterationsDone", () => {
      networkRef.current.setOptions({ physics: { enabled: false } });
      setPhysicsActive(false);
      networkRef.current.fit({ padding: 50, animation: { duration: 350 } });
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
      networkRef.current.fit({ padding: 50, animation: { duration: 350 } });
    }
  };

  return (
    <div className={`network-section-container ${isExpanded ? "expanded-view" : "compact-view"}`}>
      {/* Header bar of the network panel */}
      <div className="network-panel-header">
        <div className="flex-align-gap">
          <Layers size={16} className="text-highlight" />
          <span className="network-panel-title">
            {selectedGroupId ? `Visualizing Ring: ${selectedGroupId}` : "Full Network Topology"}
          </span>
          <span className="network-counter-pill">
            {filteredData.visibleNodes.length} accounts / {filteredData.visibleEdges.length} transfers
          </span>
        </div>

        <div className="network-header-actions">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="expand-toggle-btn"
              title={isExpanded ? "Restore Split View" : "Expand to Full Width"}
            >
              {isExpanded ? <Minimize size={14} /> : <Maximize size={14} />}
              <span>{isExpanded ? "Collapse View" : "Expand Fullscreen"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured, Clean Controls Toolbar */}
      <div className="clean-toolbar">
        <div className="toolbar-row primary-controls">
          <form className="search-bar-clean" onSubmit={handleSearch}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Find account (e.g. ACC_ALPHA_1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="clear-search-btn" title="Clear">
                <X size={13} />
              </button>
            )}
            <button type="submit" className="search-submit-btn">Locate</button>
          </form>

          {/* Group Selector Dropdown */}
          <div className="group-dropdown-wrapper">
            <select
              value={selectedGroupId || "ALL"}
              onChange={(e) => {
                const val = e.target.value;
                onSelectGroup(val === "ALL" ? null : val);
              }}
              className="group-select"
            >
              <option value="ALL">Show All Accounts ({groups.length} groups)</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_id} — {g.risk_level} ({Math.round(g.risk_score)} pts)
                </option>
              ))}
            </select>
          </div>

          {(selectedGroupId || filterRisk !== "ALL" || minAmount > 0) && (
            <button onClick={resetAllFilters} className="btn-reset-filters" title="Reset all filters">
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {searchFeedback && (
          <div className="search-feedback-banner">
            <AlertOctagon size={13} /> {searchFeedback}
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="canvas-dock-layout">
        <div className="canvas-main-area">
          <div ref={containerRef} className="vis-canvas" />

          {/* Floating Navigation Controls */}
          <div className="floating-nav-dock">
            <button onClick={handleZoomIn} title="Zoom In" className="nav-dock-btn">
              <ZoomIn size={15} />
            </button>
            <button onClick={handleZoomOut} title="Zoom Out" className="nav-dock-btn">
              <ZoomOut size={15} />
            </button>
            <div className="nav-dock-divider" />
            <button onClick={handleFit} title="Fit to Screen" className="nav-dock-btn">
              <Maximize2 size={15} />
            </button>
            <button onClick={handleReLayout} title="Rearrange Layout" className="nav-dock-btn">
              <RotateCcw size={15} />
            </button>
            <button
              onClick={togglePhysics}
              title={physicsActive ? "Physics is Active (Click to Freeze)" : "Physics is Frozen"}
              className={`nav-dock-btn ${physicsActive ? "active-physics" : ""}`}
            >
              {physicsActive ? <Unlock size={15} /> : <Lock size={15} />}
            </button>
          </div>

          {/* Collapsible Legend at Bottom-Left */}
          <div className="collapsible-legend-dock">
            <button
              type="button"
              className="legend-toggle-btn"
              onClick={() => setShowLegend(!showLegend)}
            >
              <span>Legend</span>
              {showLegend ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>

            {showLegend && (
              <div className="legend-expanded-content">
                <div className="legend-row">
                  <span className="dot dot-critical" /> <span>Critical ({">="}80 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-high" /> <span>High (60–79 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-medium" /> <span>Medium (35–59 pts)</span>
                </div>
                <div className="legend-row">
                  <span className="dot dot-low" /> <span>Low (0–34 pts)</span>
                </div>
                <div className="legend-divider" />
                <div className="legend-row">
                  <span className="line-suspicious" /> <span>Suspicious Ring Flow</span>
                </div>
                <div className="legend-row">
                  <span className="line-normal" /> <span>Standard Payment</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Docked Inspector Panel */}
        {activeSelection && (
          <aside className="docked-inspector-panel">
            <div className="inspector-top-bar">
              <h4>{activeSelection.type === "node" ? "Account Inspector" : "Transfer Inspector"}</h4>
              <button onClick={() => setActiveSelection(null)} className="close-dock-btn" title="Close Panel">
                <X size={15} />
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
                      <span className="flow-role">Sender</span>
                      <strong className="mono">{activeSelection.data.from_node}</strong>
                    </div>
                    <div className="flow-arrow">&darr;</div>
                    <div className="flow-node">
                      <span className="flow-role">Receiver</span>
                      <strong className="mono">{activeSelection.data.to_node}</strong>
                    </div>
                  </div>

                  <div className="inspector-stat-grid">
                    <div className="stat-tile">
                      <span className="stat-label">Amount</span>
                      <span className="stat-value text-highlight font-semibold">
                        ${activeSelection.data.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-label">Status</span>
                      <span className={activeSelection.data.is_suspicious ? "badge badge-critical" : "badge badge-low"}>
                        {activeSelection.data.is_suspicious ? "SUSPICIOUS" : "STANDARD"}
                      </span>
                    </div>
                  </div>

                  <div className="timestamp-tile">
                    <span className="stat-label">Timestamp</span>
                    <span className="mono text-xs">{activeSelection.data.timestamp}</span>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
