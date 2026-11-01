from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Any, Set, Tuple, Optional
import networkx as nx
from dateutil import parser as date_parser

from backend.schemas.transaction import TransactionRecord
from backend.schemas.graph import (
    GraphNode,
    GraphEdge,
    PatternDetection,
    SuspiciousGroup,
    GraphAnalysisResponse,
    GraphAnalysisSummary,
)
from backend.database.db import get_all_investigations, get_investigation
from backend.schemas.investigation import InvestigationStatus
from backend.services.risk_scoring_service import calculate_group_risk, generate_summary_narrative, generate_suggested_steps


def _to_epoch(iso_timestamp: str) -> float:
    try:
        dt = date_parser.isoparse(iso_timestamp)
        return dt.timestamp()
    except Exception:
        return datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00")).timestamp()


class GraphFraudEngine:
    def __init__(
        self,
        rapid_transfer_window_sec: float = 900.0,       # 15 minutes
        common_recipient_window_sec: float = 3600.0,    # 1 hour
        common_recipient_min_senders: int = 3,
        repeated_interaction_min_count: int = 3,
        repeated_interaction_window_sec: float = 3600.0,
        multi_hop_min_length: int = 3,
        multi_hop_max_window_sec: float = 7200.0,       # 2 hours
        max_cycle_length: int = 5,
    ):
        self.rapid_transfer_window_sec = rapid_transfer_window_sec
        self.common_recipient_window_sec = common_recipient_window_sec
        self.common_recipient_min_senders = common_recipient_min_senders
        self.repeated_interaction_min_count = repeated_interaction_min_count
        self.repeated_interaction_window_sec = repeated_interaction_window_sec
        self.multi_hop_min_length = multi_hop_min_length
        self.multi_hop_max_window_sec = multi_hop_max_window_sec
        self.max_cycle_length = max_cycle_length

    def build_graph(self, transactions: List[TransactionRecord]) -> nx.MultiDiGraph:
        G = nx.MultiDiGraph()
        for tx in transactions:
            epoch = _to_epoch(tx.timestamp)
            G.add_node(tx.sender_id)
            G.add_node(tx.receiver_id)
            G.add_edge(
                tx.sender_id,
                tx.receiver_id,
                key=tx.transaction_id,
                transaction_id=tx.transaction_id,
                amount=tx.amount,
                timestamp=tx.timestamp,
                epoch=epoch,
            )
        return G

    def detect_circular_money_movement(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # Convert to simple DiGraph to find elementary cycles up to max_cycle_length
        simple_digraph = nx.DiGraph()
        for u, v, data in G.edges(data=True):
            simple_digraph.add_edge(u, v)

        cycles = []
        for cycle in nx.simple_cycles(simple_digraph):
            if 3 <= len(cycle) <= self.max_cycle_length:
                cycles.append(cycle)
            elif len(cycle) > self.max_cycle_length:
                continue

        # For each cycle found, gather transactions that form this cycle
        seen_cycles_set = set()
        for cycle in cycles:
            cycle_tuple = tuple(sorted(cycle))
            if cycle_tuple in seen_cycles_set:
                continue
            seen_cycles_set.add(cycle_tuple)

            cycle_txs = []
            cycle_nodes = list(cycle)
            for i in range(len(cycle_nodes)):
                u = cycle_nodes[i]
                v = cycle_nodes[(i + 1) % len(cycle_nodes)]
                edge_dict = G.get_edge_data(u, v)
                if edge_dict:
                    # Pick the edge data
                    for key, data in edge_dict.items():
                        cycle_txs.append(data["transaction_id"])

            cycle_path_str = " -> ".join(cycle_nodes) + f" -> {cycle_nodes[0]}"
            detections.append(
                PatternDetection(
                    pattern_type="CIRCULAR_FLOW",
                    title="Circular Money Movement (Cycle)",
                    description=f"Closed circular transaction cycle detected across {len(cycle_nodes)} accounts: {cycle_path_str}.",
                    severity="CRITICAL",
                    accounts_involved=cycle_nodes,
                    transactions_involved=cycle_txs,
                    evidence_details={
                        "cycle_length": len(cycle_nodes),
                        "cycle_path": cycle_nodes + [cycle_nodes[0]],
                        "cycle_path_string": cycle_path_str,
                    },
                )
            )
        return detections

    def detect_common_recipient_concentration(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # Group incoming transactions by recipient
        incoming_by_recipient = defaultdict(list)
        for tx in transactions:
            incoming_by_recipient[tx.receiver_id].append(tx)

        for recipient, tx_list in incoming_by_recipient.items():
            if len(tx_list) < self.common_recipient_min_senders:
                continue

            # Sort by epoch time
            sorted_txs = sorted(tx_list, key=lambda t: _to_epoch(t.timestamp))
            n = len(sorted_txs)

            # Check sliding window for multiple distinct senders within common_recipient_window_sec
            flagged_windows = []
            for i in range(n):
                window_txs = [sorted_txs[i]]
                t_start = _to_epoch(sorted_txs[i].timestamp)
                for j in range(i + 1, n):
                    if _to_epoch(sorted_txs[j].timestamp) - t_start <= self.common_recipient_window_sec:
                        window_txs.append(sorted_txs[j])
                    else:
                        break

                distinct_senders = set(t.sender_id for t in window_txs)
                if len(distinct_senders) >= self.common_recipient_min_senders:
                    # Check context: is the recipient an ordinary e-commerce merchant?
                    # An e-commerce merchant receives payments spread widely across hours or days,
                    # whereas smurfing / concentration concentrates structured amounts rapidly.
                    time_span = _to_epoch(window_txs[-1].timestamp) - _to_epoch(window_txs[0].timestamp)
                    # If senders >= 3 within <= 3600 seconds, flag concentration
                    flagged_windows.append((window_txs, distinct_senders, time_span))

            if flagged_windows:
                # Merge overlapping windows for this recipient
                all_involved_txs = set()
                all_senders = set()
                min_span = float("inf")
                for w_txs, s_set, span in flagged_windows:
                    for t in w_txs:
                        all_involved_txs.add(t.transaction_id)
                    all_senders.update(s_set)
                    min_span = min(min_span, span)

                # Contextual check: does the recipient also rapidly disperse funds to an offshore/collector account?
                outgoing = [tx for tx in transactions if tx.sender_id == recipient]
                outgoing_tx_ids = [tx.transaction_id for tx in outgoing]

                accounts = list(all_senders) + [recipient]
                all_tx_list = list(all_involved_txs) + outgoing_tx_ids

                detections.append(
                    PatternDetection(
                        pattern_type="COMMON_RECIPIENT_CONCENTRATION",
                        title="Common-Recipient Concentration (Smurfing)",
                        description=(
                            f"{len(all_senders)} distinct sender accounts transferred funds to recipient "
                            f"'{recipient}' within a narrow time window ({int(min_span // 60)} minutes)."
                        ),
                        severity="HIGH",
                        accounts_involved=accounts,
                        transactions_involved=all_tx_list,
                        evidence_details={
                            "recipient": recipient,
                            "senders_count": len(all_senders),
                            "senders": list(all_senders),
                            "incoming_tx_count": len(all_involved_txs),
                            "has_subsequent_outgoing": len(outgoing) > 0,
                            "time_span_minutes": round(min_span / 60.0, 1),
                        },
                    )
                )

        return detections

    def detect_rapid_connected_transfers(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # For each node B with both in-edges and out-edges, check if incoming is followed by outgoing within rapid window
        for node in G.nodes():
            in_edges = list(G.in_edges(node, data=True))
            out_edges = list(G.out_edges(node, data=True))
            if not in_edges or not out_edges:
                continue

            for u, _, in_data in in_edges:
                t_in = in_data["epoch"]
                for _, w, out_data in out_edges:
                    if u == w:
                        continue  # back-and-forth handled in repeated interactions
                    t_out = out_data["epoch"]
                    delta = t_out - t_in
                    if 0 < delta <= self.rapid_transfer_window_sec:
                        detections.append(
                            PatternDetection(
                                pattern_type="RAPID_CONNECTED_TRANSFER",
                                title="Rapid Connected Passthrough",
                                description=(
                                    f"Account '{node}' received ${in_data['amount']:,.2f} from '{u}' and "
                                    f"transferred ${out_data['amount']:,.2f} to '{w}' within {int(delta // 60)} minutes."
                                ),
                                severity="HIGH",
                                accounts_involved=[u, node, w],
                                transactions_involved=[in_data["transaction_id"], out_data["transaction_id"]],
                                evidence_details={
                                    "intermediary": node,
                                    "origin": u,
                                    "destination": w,
                                    "delta_seconds": delta,
                                    "delta_minutes": round(delta / 60.0, 1),
                                    "in_amount": in_data["amount"],
                                    "out_amount": out_data["amount"],
                                },
                            )
                        )
        return detections

    def detect_multi_hop_chains(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # Find paths of length >= 3 hops where each subsequent edge timestamp > previous within total window
        # We perform DFS paths up to length 4 hops
        tx_by_id = {tx.transaction_id: tx for tx in transactions}

        def find_chains(current_node: str, current_path: List[str], current_txs: List[str], start_time: float):
            if len(current_path) >= self.multi_hop_min_length + 1:
                total_duration = _to_epoch(tx_by_id[current_txs[-1]].timestamp) - start_time
                if total_duration <= self.multi_hop_max_window_sec:
                    chain_str = " -> ".join(current_path)
                    detections.append(
                        PatternDetection(
                            pattern_type="MULTI_HOP_CHAIN",
                            title=f"Multi-Hop Layering Chain ({len(current_path) - 1} Hops)",
                            description=f"Rapid chronological transaction chain spanning {len(current_path)} accounts: {chain_str} in {int(total_duration // 60)} minutes.",
                            severity="HIGH",
                            accounts_involved=list(current_path),
                            transactions_involved=list(current_txs),
                            evidence_details={
                                "chain_length_hops": len(current_path) - 1,
                                "chain_accounts": current_path,
                                "duration_minutes": round(total_duration / 60.0, 1),
                            },
                        )
                    )
                return

            last_tx_time = _to_epoch(tx_by_id[current_txs[-1]].timestamp) if current_txs else start_time
            for _, nxt, data in G.out_edges(current_node, data=True):
                if nxt in current_path:
                    continue  # avoid cycles here
                nxt_time = data["epoch"]
                if nxt_time >= last_tx_time and (nxt_time - start_time) <= self.multi_hop_max_window_sec:
                    find_chains(nxt, current_path + [nxt], current_txs + [data["transaction_id"]], start_time)

        # Search from nodes that have in-degree 0 or are start of flows
        for node in G.nodes():
            for _, nxt, data in G.out_edges(node, data=True):
                find_chains(nxt, [node, nxt], [data["transaction_id"]], data["epoch"])

        # Deduplicate redundant sub-chains
        unique_detections = []
        seen_tx_sets = []
        for det in detections:
            tx_set = set(det.transactions_involved)
            # If this is a superset of an existing one, replace or keep longest
            is_subset = False
            for prev_set in seen_tx_sets:
                if tx_set.issubset(prev_set):
                    is_subset = True
                    break
            if not is_subset:
                seen_tx_sets.append(tx_set)
                unique_detections.append(det)

        return unique_detections

    def detect_repeated_interactions(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # Group pairs (min(u,v), max(u,v))
        pair_txs = defaultdict(list)
        for tx in transactions:
            pair = tuple(sorted([tx.sender_id, tx.receiver_id]))
            pair_txs[pair].append(tx)

        for (acc_a, acc_b), tx_list in pair_txs.items():
            if len(tx_list) >= self.repeated_interaction_min_count:
                sorted_txs = sorted(tx_list, key=lambda t: _to_epoch(t.timestamp))
                t_first = _to_epoch(sorted_txs[0].timestamp)
                t_last = _to_epoch(sorted_txs[-1].timestamp)
                delta = t_last - t_first

                # Check if concentrated in repeated_interaction_window_sec
                if delta <= self.repeated_interaction_window_sec:
                    total_amount = sum(t.amount for t in sorted_txs)
                    detections.append(
                        PatternDetection(
                            pattern_type="REPEATED_INTERACTIONS",
                            title="High-Frequency Repeated Interactions (Ping-Pong)",
                            description=(
                                f"{len(sorted_txs)} rapid transfers totaling ${total_amount:,.2f} detected between "
                                f"'{acc_a}' and '{acc_b}' within {max(1, int(delta // 60))} minutes."
                            ),
                            severity="MEDIUM" if len(sorted_txs) < 5 else "HIGH",
                            accounts_involved=[acc_a, acc_b],
                            transactions_involved=[t.transaction_id for t in sorted_txs],
                            evidence_details={
                                "pair": [acc_a, acc_b],
                                "transfer_count": len(sorted_txs),
                                "total_amount": total_amount,
                                "duration_minutes": round(delta / 60.0, 1),
                            },
                        )
                    )
        return detections

    def detect_velocity_anomalies(
        self, G: nx.MultiDiGraph, transactions: List[TransactionRecord]
    ) -> List[PatternDetection]:
        detections: List[PatternDetection] = []
        # Check accounts with unusually high burst of transactions (> 5 txs within 15 minutes)
        by_account = defaultdict(list)
        for tx in transactions:
            by_account[tx.sender_id].append(tx)
            by_account[tx.receiver_id].append(tx)

        for acc, tx_list in by_account.items():
            if len(tx_list) >= 5:
                sorted_txs = sorted(tx_list, key=lambda t: _to_epoch(t.timestamp))
                # Check 15-minute bursts
                for i in range(len(sorted_txs)):
                    t0 = _to_epoch(sorted_txs[i].timestamp)
                    burst = [t for t in sorted_txs[i:] if _to_epoch(t.timestamp) - t0 <= 900.0]
                    if len(burst) >= 5:
                        tx_ids = list(set(t.transaction_id for t in burst))
                        detections.append(
                            PatternDetection(
                                pattern_type="VELOCITY_ANOMALY",
                                title="Abnormal Transaction Velocity Spike",
                                description=f"Account '{acc}' had {len(burst)} transactions within 15 minutes.",
                                severity="MEDIUM",
                                accounts_involved=[acc],
                                transactions_involved=tx_ids,
                                evidence_details={
                                    "account": acc,
                                    "burst_count": len(burst),
                                    "window_minutes": 15,
                                },
                            )
                        )
                        break
        return detections

    def analyze(self, transactions: List[TransactionRecord]) -> GraphAnalysisResponse:
        G = self.build_graph(transactions)
        persisted_investigations = get_all_investigations()

        # Run all pattern detectors
        all_patterns: List[PatternDetection] = []
        all_patterns.extend(self.detect_circular_money_movement(G, transactions))
        all_patterns.extend(self.detect_common_recipient_concentration(G, transactions))
        all_patterns.extend(self.detect_rapid_connected_transfers(G, transactions))
        all_patterns.extend(self.detect_multi_hop_chains(G, transactions))
        all_patterns.extend(self.detect_repeated_interactions(G, transactions))
        all_patterns.extend(self.detect_velocity_anomalies(G, transactions))

        # Cluster patterns into cohesive SuspiciousGroups based on shared accounts/transactions
        # Build an undirected pattern adjacency graph
        pat_graph = nx.Graph()
        for idx, pat in enumerate(all_patterns):
            pat_graph.add_node(idx)

        for i in range(len(all_patterns)):
            for j in range(i + 1, len(all_patterns)):
                shared_accs = set(all_patterns[i].accounts_involved).intersection(all_patterns[j].accounts_involved)
                shared_txs = set(all_patterns[i].transactions_involved).intersection(all_patterns[j].transactions_involved)
                if shared_accs or shared_txs:
                    pat_graph.add_edge(i, j)

        groups: List[SuspiciousGroup] = []
        group_counter = 1
        tx_lookup = {t.transaction_id: t for t in transactions}

        # For mapping nodes and edges to groups
        node_group_map = defaultdict(list)
        edge_group_map = defaultdict(list)

        for comp in nx.connected_components(pat_graph):
            comp_patterns = [all_patterns[idx] for idx in comp]
            group_accounts = sorted(list(set(acc for p in comp_patterns for acc in p.accounts_involved)))
            group_tx_ids = sorted(list(set(tx for p in comp_patterns for tx in p.transactions_involved)))

            group_tx_objects = [tx_lookup[tx_id] for tx_id in group_tx_ids if tx_id in tx_lookup]
            total_vol = sum(t.amount for t in group_tx_objects)

            earliest_ts = min((t.timestamp for t in group_tx_objects), default=None)
            latest_ts = max((t.timestamp for t in group_tx_objects), default=None)

            # Assign a deterministic and clean Group ID based on primary pattern
            primary_pat = comp_patterns[0].pattern_type
            if "CIRCULAR" in primary_pat:
                prefix = "RING"
            elif "COMMON_RECIPIENT" in primary_pat:
                prefix = "SMURF"
            elif "MULTI_HOP" in primary_pat:
                prefix = "CHAIN"
            elif "REPEATED" in primary_pat:
                prefix = "PAIR"
            else:
                prefix = "GRP"

            group_id = f"GRP_{prefix}_{group_counter:02d}"
            group_counter += 1

            # Calculate deterministic risk score
            risk_score, risk_level, score_breakdown = calculate_group_risk(
                patterns=comp_patterns,
                accounts_count=len(group_accounts),
                transactions_count=len(group_tx_ids),
                total_volume=total_vol,
            )

            # Generate natural explainable summary and actionable steps
            narrative = generate_summary_narrative(comp_patterns, group_accounts, total_vol)
            suggested_steps = generate_suggested_steps(comp_patterns)

            # Check persistent investigation status from SQLite
            inv_data = persisted_investigations.get(group_id)
            if inv_data:
                status = InvestigationStatus(inv_data["status"])
                notes = inv_data.get("notes", "")
                assigned_to = inv_data.get("assigned_to", "Fraud Analyst")
                updated_at = inv_data.get("updated_at", datetime.now().isoformat())
            else:
                status = InvestigationStatus.NEW
                notes = ""
                assigned_to = "Fraud Analyst"
                updated_at = datetime.now().isoformat()

            suspicious_group = SuspiciousGroup(
                group_id=group_id,
                risk_score=risk_score,
                risk_level=risk_level,
                accounts=group_accounts,
                transactions=group_tx_ids,
                patterns=comp_patterns,
                score_breakdown=score_breakdown,
                total_volume=round(total_vol, 2),
                earliest_timestamp=earliest_ts,
                latest_timestamp=latest_ts,
                summary_narrative=narrative,
                suggested_steps=suggested_steps,
                status=status,
                assigned_to=assigned_to,
                notes=notes,
                updated_at=updated_at,
            )
            groups.append(suspicious_group)

            for acc in group_accounts:
                node_group_map[acc].append(group_id)
            for tx_id in group_tx_ids:
                edge_group_map[tx_id].append(group_id)

        # Sort groups by risk score descending
        groups.sort(key=lambda g: g.risk_score, reverse=True)

        # Build GraphNodes and GraphEdges for frontend visualization
        all_nodes: List[GraphNode] = []
        for node in G.nodes():
            in_deg = G.in_degree(node)
            out_deg = G.out_degree(node)
            in_amt = sum(data["amount"] for _, _, data in G.in_edges(node, data=True))
            out_amt = sum(data["amount"] for _, _, data in G.out_edges(node, data=True))
            g_ids = node_group_map.get(node, [])

            # Node risk level from belonging groups
            if any(g.risk_level == "CRITICAL" for g in groups if g.group_id in g_ids):
                node_risk = "CRITICAL"
            elif any(g.risk_level == "HIGH" for g in groups if g.group_id in g_ids):
                node_risk = "HIGH"
            elif any(g.risk_level == "MEDIUM" for g in groups if g.group_id in g_ids):
                node_risk = "MEDIUM"
            else:
                node_risk = "LOW"

            all_nodes.append(
                GraphNode(
                    id=node,
                    label=node,
                    in_degree=in_deg,
                    out_degree=out_deg,
                    total_inflow=round(in_amt, 2),
                    total_outflow=round(out_amt, 2),
                    risk_level=node_risk,
                    group_ids=g_ids,
                )
            )

        all_edges: List[GraphEdge] = []
        for u, v, data in G.edges(data=True):
            tx_id = data["transaction_id"]
            g_ids = edge_group_map.get(tx_id, [])
            all_edges.append(
                GraphEdge(
                    id=f"{u}->{v}:{tx_id}",
                    from_node=u,
                    to_node=v,
                    amount=data["amount"],
                    timestamp=data["timestamp"],
                    transaction_id=tx_id,
                    is_suspicious=len(g_ids) > 0,
                    group_ids=g_ids,
                )
            )

        # Compute summary
        total_tx_count = len(transactions)
        total_accounts_count = len(all_nodes)
        suspicious_tx_set = set(tx for g in groups for tx in g.transactions)
        suspicious_vol = sum(tx_lookup[tx_id].amount for tx_id in suspicious_tx_set if tx_id in tx_lookup)
        total_vol = sum(tx.amount for tx in transactions)
        high_crit_count = sum(1 for g in groups if g.risk_level in ["HIGH", "CRITICAL"])
        awaiting_review = sum(1 for g in groups if g.status in [InvestigationStatus.NEW, InvestigationStatus.UNDER_REVIEW])

        summary = GraphAnalysisSummary(
            total_transactions=total_tx_count,
            total_accounts=total_accounts_count,
            suspicious_groups_count=len(groups),
            suspicious_transactions_count=len(suspicious_tx_set),
            high_or_critical_groups_count=high_crit_count,
            total_suspicious_volume=round(suspicious_vol, 2),
            total_volume=round(total_vol, 2),
            groups_awaiting_review=awaiting_review,
        )

        return GraphAnalysisResponse(
            summary=summary,
            nodes=all_nodes,
            edges=all_edges,
            groups=groups,
        )


# Global singleton instance of engine
graph_fraud_engine = GraphFraudEngine()
