import React, { useState, useEffect } from "react";
import { CreditCard, CheckCircle, AlertCircle, ArrowUpRight, ShieldCheck, RefreshCw } from "lucide-react";
import { getPayPalStatus, createPayPalOrder, capturePayPalOrder } from "../services/api";

export default function PayPalSandboxPortal() {
  const [statusInfo, setStatusInfo] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [orderAmount, setOrderAmount] = useState("250.00");
  const [orderCurrency, setOrderCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderError, setOrderError] = useState("");

  const [captureOrderId, setCaptureOrderId] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState(null);
  const [captureError, setCaptureError] = useState("");

  useEffect(() => {
    async function loadStatus() {
      try {
        setLoadingStatus(true);
        const data = await getPayPalStatus();
        setStatusInfo(data);
      } catch (err) {
        setStatusInfo({ configured: false, error: err.message });
      } finally {
        setLoadingStatus(false);
      }
    }
    loadStatus();
  }, []);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      setOrderError("");
      setOrderResult(null);
      const res = await createPayPalOrder(orderAmount, orderCurrency);
      setOrderResult(res);
      if (res.order_id) {
        setCaptureOrderId(res.order_id);
      }
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCaptureOrder = async (e) => {
    e.preventDefault();
    if (!captureOrderId.trim()) return;
    try {
      setCapturing(true);
      setCaptureError("");
      setCaptureResult(null);
      const res = await capturePayPalOrder(captureOrderId.trim());
      setCaptureResult(res);
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="paypal-portal">
      <div className="portal-header">
        <div className="flex-align-gap">
          <CreditCard size={24} className="text-highlight" />
          <h2>PayPal Sandbox Integration Portal</h2>
        </div>
        <p className="text-muted">
          Live verification of PayPal Sandbox order creation, approval redirection, capture, and fraud correlation.
        </p>
      </div>

      {/* Configuration Status Card */}
      <div className="config-status-card">
        <div className="flex-align-gap">
          {statusInfo?.configured ? (
            <span className="status-dot status-dot-online" />
          ) : (
            <span className="status-dot status-dot-offline" />
          )}
          <strong>
            PayPal Sandbox API Status: {statusInfo?.configured ? "Configured & Authenticated" : "Not Configured / Offline"}
          </strong>
        </div>
        {statusInfo && (
          <div className="config-meta text-sm text-muted">
            <span>Base URL: <code className="mono">{statusInfo.base_url}</code></span>
            {statusInfo.client_id_prefix && (
              <span>Client ID: <code className="mono">{statusInfo.client_id_prefix}</code></span>
            )}
          </div>
        )}
      </div>

      <div className="grid-2-cols">
        {/* Step 1: Create Order */}
        <div className="portal-card">
          <div className="card-badge">Step 1</div>
          <h3>Create Sandbox Payment Order</h3>
          <p className="text-sm text-muted">
            Initiate a payment through the backend to PayPal's v2/checkout/orders API.
          </p>

          <form onSubmit={handleCreateOrder} className="portal-form">
            <div className="form-group">
              <label>Amount:</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Currency:</label>
              <select value={orderCurrency} onChange={(e) => setOrderCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? "Creating Order..." : "Create Sandbox Order"}
            </button>
          </form>

          {orderError && (
            <div className="status-alert status-alert-error">
              <AlertCircle size={16} /> {orderError}
            </div>
          )}

          {orderResult && (
            <div className="status-alert status-alert-success">
              <CheckCircle size={16} />
              <div>
                <p>Order Created: <strong className="mono">{orderResult.order_id}</strong></p>
                <p>Status: <strong>{orderResult.status}</strong></p>
                {orderResult.approve_url && (
                  <a
                    href={orderResult.approve_url}
                    target="_blank"
                    rel="noreferrer"
                    className="approve-link"
                  >
                    Approve in PayPal Sandbox Portal <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Capture Order */}
        <div className="portal-card">
          <div className="card-badge">Step 2</div>
          <h3>Capture & Ingest Payment</h3>
          <p className="text-sm text-muted">
            Complete capture workflow and inspect the resulting transaction payload.
          </p>

          <form onSubmit={handleCaptureOrder} className="portal-form">
            <div className="form-group">
              <label>PayPal Order ID:</label>
              <input
                type="text"
                placeholder="e.g. 5O190127TN364715T"
                value={captureOrderId}
                onChange={(e) => setCaptureOrderId(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={capturing || !captureOrderId} className="btn-secondary">
              {capturing ? "Capturing Order..." : "Capture Sandbox Order"}
            </button>
          </form>

          {captureError && (
            <div className="status-alert status-alert-error">
              <AlertCircle size={16} /> {captureError}
            </div>
          )}

          {captureResult && (
            <div className="status-alert status-alert-success">
              <ShieldCheck size={16} />
              <div>
                <p>Order Captured: <strong className="mono">{captureResult.order_id}</strong></p>
                <p>Status: <strong>{captureResult.status}</strong></p>
                <p className="text-sm text-muted">
                  Payer: {captureResult.payer?.email_address || "Verified Sandbox Payer"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
