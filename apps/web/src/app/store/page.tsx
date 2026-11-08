import { Storefront } from "@/components/storefront";

export const metadata = { title: "Store & wallet" };

export default function StorePage() {
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">GEAR UP FOR THE NEXT ROUND</div><h1 className="page-title">The player shop.</h1><p className="page-intro">Community-made digital collectibles and event passes. The demo catalog is free to browse; real purchases stay disabled until a payment provider is configured.</p>
    <Storefront />
  </div></section>;
}
