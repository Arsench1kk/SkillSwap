import Link from "next/link";
import { messages } from "@/messages/en";

export function PublicPageLoading() {
  return (
    <main className="public-page">
      <div className="public-content">
        <Link className="public-brand" href="/">
          {messages.brand}
        </Link>
        <section className="public-panel" role="status" aria-busy="true">
          <p className="public-copy">{messages.loading}</p>
        </section>
      </div>
    </main>
  );
}
