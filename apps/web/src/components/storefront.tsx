"use client";

import { useState } from "react";
import { Check, ShoppingBag, Wallet } from "lucide-react";

const products = [
  { sku: "neon-card", name: "Neon Circuit player card", kind: "DIGITAL COLLECTIBLE", price: "$4.99", art: "violet" },
  { sku: "season-pass", name: "ClutchVerse season pass", kind: "EVENT ACCESS", price: "$9.99", art: "green" },
  { sku: "badge-set", name: "Ranked ladder badge set", kind: "PROFILE COSMETIC", price: "$2.99", art: "gold" },
];

export function Storefront() {
  const [cart, setCart] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const checkout = async () => {
    const product = products.find((item) => item.name === cart[0]);
    if (!product) return;
    setBusy(true);
    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "store_item", sku: product.sku }),
    });
    const result = await response.json() as { checkoutUrl?: string; status?: string; error?: string };
    setBusy(false);
    if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    else setMessage(result.status === "pending_demo" ? "Demo checkout is pending. No funds were moved." : result.error ?? "Checkout is unavailable.");
  };
  return <>
    <div className="wallet-bar panel"><div><Wallet size={19} /><span><small>DEMO WALLET BALANCE</small><strong>$0.00</strong></span></div><span className="tag">NO REAL FUNDS</span></div>
    <div className="store-toolbar"><span className="eyebrow">FEATURED ITEMS</span><span className="cart-count"><ShoppingBag size={14} /> CART {cart.length}</span></div>
    <div className="product-grid">{products.map((product) => <article className="product-card panel" key={product.name}><div className={`product-art product-${product.art}`}><span className="product-glyph">CV</span></div><div className="product-info"><span className="eyebrow">{product.kind}</span><h2>{product.name}</h2><div className="product-buy"><strong>{product.price}</strong><button className="button" onClick={() => { setCart((items) => [...items, product.name]); setMessage(`${product.name} added to your demo cart.`); }}><ShoppingBag size={13} /> Add</button></div></div></article>)}</div>
    {message && <div className="store-message" role="status"><Check size={14} />{message} This preview never charges your account.</div>}
    {cart.length > 0 && <button className="button button-primary checkout-button" disabled={busy} onClick={checkout}>{busy ? "STARTING CHECKOUT..." : `Checkout (${cart.length})`}</button>}
  </>;
}
