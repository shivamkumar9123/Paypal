import React, { useEffect, useRef, useState, useMemo } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Filter,
  Play,
  Pause,
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";

const RISK_COLORS = {
  CRITICAL: { background: "#dc2626", border: "#ef4444", highlight: { background: "#ef4444", border: "#f87171" } },
  HIGH: { background: "#ea580c", border: "#f97316", highlight: { background: "#f97316", border: "#fb923c" } },
  MEDIUM: { background: "#d97706", border: "#f59e0b", highlight: { background: "#f59e0b", border: "#fbbf24" } },
  LOW: { background: "#0284c7", border: "#38bdf8", highlight: { background: "#38bdf8", border: "#7dd3fc" } },
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
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [activeSelection, setActiveSelection] = useState(null);

  // Filter nodes & edges
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

    // Filter by Risk
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
          size: Math.max(16, Math.min(30, 14 + (node.in_degree + node.out_degree) * 2)),
          margin: 8,
          borderWidth: 2,
          title: `Account: ${node.id}
Risk: ${node.risk_level}
Inflow: $${node.total_inflow.toLocaleString()}
Outflow: $${node.total_outflow.toLocaleString()}
Connections: ${node.in_degree + node.out_degree}`,
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
          arrows: { to: { enabled: true, scaleFactor: 0.8 } },
          color: {
            color: isSusp ? "#ef4444" : "#475569",
            highlight: isSusp ? "#f87171" : "#94a3b8",
          },
          width: isSusp ? 2.5 : 1.2,
          dashes: !isSusp,
          font: {
            color: isSusp ? "#fca5a5" : "#94a3b8",
            size: 10,
            align: "middle",
            background: "#0f172a",
          },
          smooth: { type: "curvedCW", roundness: 0.15 },
        };
      })
    );

    const options = {
      nodes: {
        shadow: { enabled: true, color: "rgba(0,0,0,0.5)", size: 6, x: 2, y: 2 },
      },
      edges: {
        shadow: { enabled: false },
        hoverWidth: 1.5,
      },
      physics: {
        enabled: physicsEnabled,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        navigationButtons: false,
        keyboard: true,
        zoomView: true,
        dragView: true,
      },
    };

    const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
    networkRef.current = network;

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

    network.on("deselectNode", () => {
      setActiveSelection(null);
    });

    return () => {
      network.destroy();
    };
  }, [filteredData, physicsEnabled]);

  // Handle Search
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !networkRef.current) return;
    const targetNodeId = searchQuery.trim();
    const exists = nodes.some((n) => n.id.toLowerCase() === targetNodeId.toLowerCase());
    if (exists) {
      const match = nodes.find((n) => n.id.toLowerCase() === targetNodeId.toLowerCase());
      networkRef.current.focus(match.id, {
        scale: 1.4,
        animation: { duration: 800, easingFunction: "easeInOutQuad" },
      });
      networkRef.current.selectNodes([match.id]);
      setActiveSelection({ type: "node", data: match });
      if (onSelectNode) onSelectNode(match);
    }
  };

  const handleZoomIn = () => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale * 1.3, animation: { duration: 300 } });
  };

  const handleZoomOut = () => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale / 1.3, animation: { duration: 300 } });
  };

  const handleFit = () => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: { duration: 500 } });
  };

  return (
    <div className="network-container">
      {/* Top Filter and Controls Bar */}
      <div className="network-toolbar">
        <form className="search-form" onSubmit={handleSearch}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search account ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn-secondary btn-sm">Find</button>
        </form>

        <div className="filter-group">
          <label><Filter size={14} /> Risk:</label>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
            <option value="ALL">All Levels</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low / Normal</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Min $:</label>
          <input
            type="number"
            min="0"
            step="500"
            value={minAmount}
            onChange={(e) => setMinAmount(Number(e.target.value))}
            style={{ width: "90px" }}
          />
        </div>

        {selectedGroupId && (
          <div className="active-group-filter-badge">
            <span>Focus: {selectedGroupId}</span>
            <button onClick={() => onSelectGroup(null)}>Clear Focus</button>
          </div>
        )}

        <div className="canvas-controls">
          <button onClick={handleZoomIn} title="Zoom In" className="icon-btn"><ZoomIn size={16} /></button>
          <button onClick={handleZoomOut} title="Zoom Out" className="icon-btn"><ZoomOut size={16} /></button>
          <button onClick={handleFit} title="Fit to Screen" className="icon-btn"><Maximize2 size={16} /></button>
          <button
            onClick={() => setPhysicsEnabled(!physicsEnabled)}
            title={physicsEnabled ? "Freeze Physics" : "Enable Physics"}
            className={`icon-btn ${physicsEnabled ? "active" : ""}`}
          >
            {physicsEnabled ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="network-canvas-wrapper">
        <div ref={containerRef} className="vis-canvas" />

        {/* Legend Overlay */}
        <div className="network-legend">
          <h4>Graph Legend</h4>
          <div className="legend-item">
            <span className="dot dot-critical" /> <span>Critical Risk</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-high" /> <span>High Risk</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-medium" /> <span>Medium Risk</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-low" /> <span>Low / Legitimate</span>
          </div>
          <div className="legend-divider" />
          <div className="legend-item">
            <span className="line-suspicious" /> <span>Suspicious Flow</span>
          </div>
          <div className="legend-item">
            <span className="line-normal" /> <span>Standard Flow</span>
          </div>
        </div>

        {/* Floating Quick Inspector Drawer for Selection */}
        {activeSelection && (
          <div className="inspector-drawer">
            <div className="drawer-header">
              <h3>
                {activeSelection.type === "node" ? "Account Details" : "Transaction Details"}
              </h3>
              <button onClick={() => setActiveSelection(null)} className="close-btn">&times;</button>
            </div>
            {activeSelection.type === "node" ? (
              <div className="drawer-body">
                <div className="detail-row">
                  <span className="label">Account ID:</span>
                  <strong className="mono">{activeSelection.data.id}</strong>
                </div>
                <div className="detail-row">
                  <span className="label">Risk Level:</span>
                  <span className={`badge badge-${activeSelection.data.risk_level.toLowerCase()}`}>
                    {activeSelection.data.risk_level}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Total Inflow:</span>
                  <span className="text-success">${activeSelection.data.total_inflow.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Total Outflow:</span>
                  <span className="text-warning">${activeSelection.data.total_outflow.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">In / Out Degree:</span>
                  <span>{activeSelection.data.in_degree} in / {activeSelection.data.out_degree} out</span>
                </div>
                {activeSelection.data.group_ids.length > 0 && (
                  <div className="drawer-section">
                    <span className="label">Linked Suspicious Groups:</span>
                    <div className="pills-container">
                      {activeSelection.data.group_ids.map((gid) => (
                        <button key={gid} className="pill-btn" onClick={() => onSelectGroup(gid)}>
                          {gid}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="drawer-body">
                <div className="detail-row">
                  <span className="label">Tx ID:</span>
                  <strong className="mono">{activeSelection.data.transaction_id}</strong>
                </div>
                <div className="detail-row">
                  <span className="label">Transfer:</span>
                  <span>{activeSelection.data.from_node} &rarr; {activeSelection.data.to_node}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="text-highlight">${activeSelection.data.amount.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Timestamp:</span>
                  <span className="mono">{activeSelection.data.timestamp}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Flagged:</span>
                  <span>{activeSelection.data.is_suspicious ? "Yes (Fraud Ring)" : "No (Normal)"}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
