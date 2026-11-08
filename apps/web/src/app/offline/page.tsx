import Link from "next/link";

export default function OfflinePage() {
  return <section className="section page-top"><div className="container narrow-page offline-panel"><div className="eyebrow">CONNECTION LOST</div><h1 className="page-title">The arena will be here.</h1><p className="page-intro">This page is not available offline yet. Reconnect to load live events, rankings, and community updates.</p><Link className="button button-primary" href="/">Back to the home page</Link></div></section>;
}
