# FraudRing AI

> **Detecting the connections behind payment fraud.**

FraudRing AI is an explainable, graph-powered financial fraud investigation platform. While traditional fraud detection inspects transactions in isolation, FraudRing AI reconstructs directed transfer networks across accounts to uncover coordinated fraud rings, smurfing networks, circular money laundering, and rapid multi-hop layering paths.

---

## 1. Product Vision & Core Architecture

A payment may appear standard on its own, but becomes suspicious when mapped within a coordinated network of transfers. FraudRing AI combines transaction-level machine learning with a graph-based analysis engine to answer:

1. **Which transactions deserve investigation?**
2. **Which accounts are connected?**
3. **What suspicious patterns were detected?**
4. **What actual evidence supports the warning?**
5. **How should an investigator proceed?**

### Architecture Diagram

```
       [ Client Browser / React 19 + vis-network Dashboard ]
                                |
                   HTTP / REST (FastAPI Backend)
                                |
      +-------------------------+-------------------------+
      |                         |                         |
[ Graph Engine ]       [ ML Inference ]           [ Persistence ]
 - NetworkX MultiDiGraph - scikit-learn Logistic  - SQLite Database
 - Cycle Detection         Regression Model       - Workflow States
 - Smurfing Detector     - Anonymized CC data     - Analyst Notes
 - Multi-Hop Layering
 - Velocity Burst
      |                         |                         |
      +-------------------------+-------------------------+
                                |
          [ Bundled Sample Dataset / User CSV Upload ]
```

- **Frontend**: React 19, Vite, `vis-network` (dark theme physics-based interactive graph), Lucide React.
- **Backend**: Python 3.14, FastAPI, Pydantic, NetworkX, Pandas, NumPy, scikit-learn.
- **Persistence**: SQLite (`fraudring.db`) for investigation workflow state and audit trails.
- **Third-Party Integrations**: Optional PayPal Sandbox order creation, capture, and fraud correlation.

---

## 2. Key Features

- **Interactive Network Graph Visualizer**: Physics-driven directed graph rendering accounts as nodes, transfers as directed edges, and risk severity as color badges (Critical, High, Medium, Low). Supports search, zoom, fit, filter by risk/amount, and group focus.
- **Explainable Fraud Alert Narratives**: Generates natural-language evidence summaries directly from observed transaction paths and timestamps.
- **Deterministic Group Risk Scoring**: Transparent 0–100 heuristic scoring with rule contributions, preventing double-counting while isolating group risk from individual transaction probability.
- **Investigation Workflow**: Full analyst lifecycle tracking (`NEW` &rarr; `UNDER_REVIEW` &rarr; `ESCALATED` &rarr; `RESOLVED`) backed by SQLite persistence that survives restarts.
- **Context-Aware Merchant Handling**: Differentiates between coordinated smurfing rings and legitimate high-volume merchants with distributed transaction times and no cycling.
- **CSV Import & Strict Validation**: Validates headers, missing IDs, self-transfers, duplicate transaction IDs, negative amounts, and invalid ISO-8601 timestamps with row-level error reporting.
- **PayPal Sandbox Portal**: Live portal for creating and capturing test payment orders to evaluate transaction indicators.

---

## 3. Dataset Format

CSV files imported into FraudRing AI must include the following headers:

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `transaction_id` | String | Unique transaction identifier | `TX_CYC_001` |
| `sender_id` | String | Originating account ID | `ACC_ALPHA_1` |
| `receiver_id` | String | Destination account ID | `ACC_BRAVO_2` |
| `amount` | Float | Transfer value (strictly positive) | `4850.00` |
| `timestamp` | String | ISO 8601 formatted timestamp | `2026-11-01T10:00:00Z` |

---

## 4. Getting Started

### Prerequisites

- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ and npm

### Installation

1. **Clone & enter the repository**:
   ```bash
   git clone https://github.com/shivamkumar9123/Paypal.git
   cd Paypal
   ```

2. **Set up Python Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` if using PayPal Sandbox (optional):
   ```bash
   cp .env.example .env
   ```

---

## 5. Running the Application

### 1. Start the Backend API

```bash
# From the repository root
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI documentation will be accessible at: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend Dashboard

```bash
# In a separate terminal window
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | API health check status |
| `GET` | `/fraud/features` | Model expected features and threshold |
| `POST` | `/fraud/predict` | Single-transaction ML classification |
| `GET` | `/graph/demo-data` | Bundled dataset metadata |
| `POST` | `/graph/load-sample` | Resets active dataset to bundled demo data |
| `POST` | `/graph/upload-csv` | Upload and validate custom CSV dataset |
| `POST` | `/graph/analyze` | Executes graph analysis and returns nodes, edges, groups |
| `GET` | `/graph/summary` | Top-level counts and statistics |
| `GET` | `/graph/groups` | Lists all detected suspicious groups |
| `GET` | `/graph/groups/{id}` | Deep evidence, timeline, and suggestions for group |
| `PATCH`| `/graph/groups/{id}/status` | Updates investigation workflow status in SQLite |
| `GET` | `/dashboard/summary` | Dashboard metrics and distributions |
| `GET` | `/paypal/status` | PayPal credentials and configuration check |
| `POST` | `/paypal/create-order`| Creates PayPal Sandbox payment order |
| `POST` | `/paypal/capture-order`| Captures approved PayPal Sandbox order |

---

## 7. Automated Testing Suite

FraudRing AI includes unit, service, integration, and validation tests with 100% pass rate:

```bash
# Run all backend tests
pytest tests -v
```

### Test Coverage Summary:
- `tests/test_graph_fraud_service.py`: Circular transfer detection, smurfing, multi-hop layering, repeated interactions, legitimate merchant controls, empty graphs.
- `tests/test_risk_scoring_service.py`: 0-100 score bounds, severity categories, signal breakdowns, actionable guidance generation.
- `tests/test_csv_validation.py`: Header validation, missing values, self-transfers, negative amounts, duplicate IDs, invalid timestamps.
- `tests/test_persistence.py`: SQLite investigation status transitions and notes persistence across restarts.
- `tests/test_api_graph.py`: Complete API integration flow for graph and dashboard routes.
- `tests/test_fraud_service.py`: Logistic regression ML feature validation and predictions.

### Frontend Production Build:
```bash
cd frontend
npm run build
```

---

## 8. Reproducible Step-by-Step Demonstration

1. **Start the Platform**: Launch FastAPI on port 8000 and Vite on port 5173.
2. **Load Sample Data**: Click **"Load Sample Data"** in the top navigation bar.
3. **Explore the Network Graph**:
   - Notice the directed red arrows showing money flow.
   - Use the **Search Account ID** input to locate `ACC_ALPHA_1`. Click **Find** to automatically focus camera on the circular ring.
   - Click on the node to open the Inspector Drawer showing inflow, outflow, and connected groups.
4. **Inspect Suspicious Groups**:
   - Switch to the **Suspicious Groups** tab.
   - Locate `GRP_RING_01` (Score: 100.0 / CRITICAL).
   - Click **Investigate**.
5. **Review Deep Investigation Evidence**:
   - Read the **Explainable Alert Narrative** describing why circular money flow was flagged.
   - Review the **Risk Score Breakdown** showing exact points for circular flow (+45) and rapid passthrough (+20).
   - Inspect the **Chronological Transfer Sequence** table.
6. **Update Investigation Status**:
   - Change the workflow dropdown from `NEW` to `UNDER_REVIEW`.
   - Enter analyst notes: *"Escalating to compliance team for immediate account hold."*
   - Click **Update Status**. The update is written to SQLite `fraudring.db`.
   - Refresh the page or restart the backend; observe that the status and notes persist.
7. **Verify Legitimate Merchant Control**:
   - Search for `ACC_MERCHANT_ECOM` in the **Transaction Explorer** tab.
   - Observe that its 12 transactions from 12 distinct buyers are classified as **LEGITIMATE** and not grouped into any fraud ring.
8. **PayPal Sandbox**:
   - Switch to the **PayPal Sandbox Portal** tab.
   - If `.env` credentials are present, enter an amount ($250.00) and click **Create Sandbox Order** to test live API communication.

---

## 9. Limitations & Ethical Considerations

- Graph detection heuristics flag structural anomalies indicating risk; they do not constitute legal proof of financial crime.
- Single-transaction ML predictions utilize the kaggle credit card dataset features (`V1`..`V28`, `Amount`); these should be trained on domain-specific features in production deployments.
- Upload file sizes are capped at 5,000 rows in this MVP to preserve responsive client-side graph rendering without WebWorker offloading.
