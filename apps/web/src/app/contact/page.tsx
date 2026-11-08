import { Mail } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="section page-top">
      <div className="container narrow-page">
        <div className="eyebrow">WE’RE LISTENING</div>
        <h1 className="page-title">Talk to the team.</h1>
        <p className="page-intro">
          For event disputes, use the event’s organizer contact so the report
          stays connected to the bracket. For platform, privacy, or partnership
          questions, reach us by email.
        </p>
        <a className="contact-card panel" href="mailto:hello@clutchverse.gg">
          <Mail size={21} />
          <span>
            <strong>hello@clutchverse.gg</strong>
            <small>General, privacy, and partnership enquiries</small>
          </span>
        </a>
        <ContactForm />
        <p className="publisher-note">
          Do not email passwords, payment card information, or other sensitive
          account credentials.
        </p>
      </div>
    </section>
  );
}
