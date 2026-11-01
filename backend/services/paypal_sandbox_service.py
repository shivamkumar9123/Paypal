import os
from pathlib import Path
from typing import Dict, Any, Optional
import httpx
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
PAYPAL_INR_PER_USD = float(os.getenv("PAYPAL_INR_PER_USD", "85"))


def get_paypal_credentials_status() -> Dict[str, Any]:
    return {
        "configured": bool(PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET),
        "base_url": PAYPAL_BASE_URL,
        "client_id_prefix": PAYPAL_CLIENT_ID[:8] + "..." if PAYPAL_CLIENT_ID else None,
    }


async def get_access_token() -> str:
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise ValueError("PayPal credentials not configured in environment.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        )
        if response.status_code != 200:
            raise ValueError(f"PayPal OAuth failed ({response.status_code}): {response.text}")

        data = response.json()
        return data["access_token"]


async def create_sandbox_order(amount: float, currency: str = "USD") -> Dict[str, Any]:
    token = await get_access_token()
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": currency,
                    "value": f"{amount:.2f}",
                },
                "description": "FraudRing AI - Live Sandbox Security Assessment Test",
            }
        ],
        "application_context": {
            "brand_name": "FraudRing AI",
            "landing_page": "NO_PREFERENCE",
            "user_action": "PAY_NOW",
            "return_url": "http://127.0.0.1:5173/paypal-success",
            "cancel_url": "http://127.0.0.1:5173/paypal-cancel",
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if response.status_code not in (200, 201):
            raise ValueError(f"PayPal order creation failed ({response.status_code}): {response.text}")

        order_data = response.json()
        # Find approval link
        approve_url = None
        for link in order_data.get("links", []):
            if link.get("rel") == "approve":
                approve_url = link.get("href")
                break

        return {
            "order_id": order_data.get("id"),
            "status": order_data.get("status"),
            "amount": amount,
            "currency": currency,
            "approve_url": approve_url,
            "raw_response": order_data,
        }


async def capture_sandbox_order(order_id: str) -> Dict[str, Any]:
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if response.status_code not in (200, 201):
            raise ValueError(f"PayPal order capture failed ({response.status_code}): {response.text}")

        capture_data = response.json()
        return {
            "order_id": capture_data.get("id"),
            "status": capture_data.get("status"),
            "payer": capture_data.get("payer", {}),
            "purchase_units": capture_data.get("purchase_units", []),
            "raw_response": capture_data,
        }
