import { Link } from "react-router-dom";
import { contactPhone } from "@home/shared";
import { useGoogleConfiguration } from "./lib/googleAuth";
import type { ReactNode } from "react";
import "./legal.css";

const businessName = "FixBezz Home appliences care";

function LegalContact() {
  const configuration = useGoogleConfiguration();
  const phone = contactPhone(configuration.data?.adminOfficePhone);
  return (
    <section id="contact">
      <h2>Contact us</h2>
      <p>
        For questions about these documents, your service, or your personal
        information, contact {businessName} through{" "}
        <Link to="/support">FixBeez Help &amp; support</Link>. You will need to
        sign in to submit and track a support request.
      </p>
      {phone && (
        <p>
          You can also call our office without signing in:{" "}
          <a href={`tel:${phone}`}>{phone}</a>.
        </p>
      )}
    </section>
  );
}

function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="section page legal-page">
      <header className="legal-heading">
        <span className="eyebrow">FIXBEEZ</span>
        <h1>{title}</h1>
        <p>{businessName}</p>
        <p className="legal-date">
          Last updated: <time dateTime="2026-11-07">7 November 2026</time>
        </p>
      </header>
      <nav className="legal-navigation" aria-label="Legal documents">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms &amp; Conditions</Link>
        <a href="#contact">Contact us</a>
      </nav>
      <div className="legal-content">
        {children}
        <LegalContact />
      </div>
    </article>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains how {businessName} ("FixBeez", "we", "us") handles
        personal information when you use fixbeez.in, our Customer web app, and
        our Android app to request appliance installation, repair and care
        services.
      </p>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your Google account
            identifier, name, email address and profile image supplied during
            Google Sign-In, together with profile details and phone numbers you
            provide. We do not receive your Google password.
          </li>
          <li>
            <strong>Service information:</strong> service addresses, appliance
            details, requested appointments, descriptions of problems, booking
            history, reviews and files or photographs you choose to upload.
          </li>
          <li>
            <strong>Communications:</strong> support requests, service-related
            messages and information you provide when contacting our team.
          </li>
          <li>
            <strong>Technical information:</strong> information associated with
            requests to our services, such as IP addresses, browser/device
            details and security or error logs. If you enable notifications, we
            process a browser push subscription to deliver updates.
          </li>
        </ul>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>
          We use information to authenticate your account, manage your profile
          and addresses, arrange and deliver requested services, assign
          technicians, provide booking updates, respond to support requests,
          maintain service records and protect the service against misuse. We
          also use relevant records to resolve complaints and meet applicable
          legal obligations.
        </p>
      </section>
      <section>
        <h2>Who receives information</h2>
        <p>
          Relevant booking, address and contact details are available to
          authorized office staff and technicians involved in your service.
          Service providers that support authentication, hosting, storage and
          notifications may process information needed for those functions.
          Google processes information under its own{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>{" "}
          when you use Google Sign-In. We may disclose information where
          required by law or where necessary to investigate fraud or protect
          legal rights.
        </p>
      </section>
      <section>
        <h2>Browser storage and permissions</h2>
        <p>
          The web app uses cookies and browser storage for functions such as
          sign-in, preferences, booking drafts and cached app files. Cached
          files allow previously visited parts of the app to open offline;
          booking and account actions may still need internet access. Clearing
          site data removes local cached information but does not itself delete
          server-side account or booking records.
        </p>
        <p>
          Notifications require your permission. You can turn them off in your
          browser or Android settings. File access is used when you choose files
          to upload. You can manage site permissions through your browser or
          device settings.
        </p>
        <p>
          If you choose the booking location feature and grant location
          permission, your browser sends your current latitude and longitude to
          our address lookup service to help fill in your service address. You
          can decline permission and enter your address manually instead.
        </p>
      </section>
      <section>
        <h2>Retention and security</h2>
        <p>
          We retain information for as long as needed to operate your account,
          fulfil service requests, resolve disputes and meet applicable
          record-keeping obligations. Some transaction, complaint, security or
          legally required records may need to be retained after an account
          deletion request. We assess these requirements when handling a request
          rather than promise a single retention period for every record.
        </p>
        <p>
          We use HTTPS and access controls to protect information. No online
          service can guarantee absolute security. Keep your Google account
          secure and sign out when using shared devices.
        </p>
      </section>
      <section>
        <h2>Your choices and account deletion</h2>
        <p>
          You can update supported profile fields and saved addresses in the
          app. To request access to, correction of, or deletion of your
          information, or to request deletion of your FixBeez account, contact
          us using the options below. Identify the Google email address used for
          FixBeez and describe your request; do not send passwords, one-time
          codes or identity documents unless a specific, appropriate
          verification step is agreed with support.
        </p>
        <p>
          We may need to verify account ownership before taking action. We will
          explain any information that must be retained for legal, security or
          unresolved service reasons. Revoking Google access or uninstalling the
          Android app does not automatically delete your FixBeez account.
        </p>
      </section>
      <section>
        <h2>Children and changes to this policy</h2>
        <p>
          FixBeez service bookings are intended for adults aged 18 or over. If a
          child has provided personal information, their parent or guardian can
          contact us about its removal. We may update this policy as our
          services change. The date above identifies the latest published
          version; we will provide additional notice where applicable law
          requires it.
        </p>
      </section>
    </LegalPage>
  );
}

export function TermsConditions() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These terms apply to your use of fixbeez.in, the FixBeez Customer web
        app and Android app, and service requests made with {businessName}{" "}
        ("FixBeez", "we", "us"). Please read them before making a booking. Our{" "}
        <Link to="/privacy">Privacy Policy</Link> explains how we handle
        personal information.
      </p>
      <section>
        <h2>Eligibility and account responsibilities</h2>
        <p>
          You must be at least 18 years old and authorized to request work at
          the service address. Provide accurate contact, address and appliance
          details, keep your account secure, and contact support if you suspect
          unauthorized use. Do not use the service for unlawful activity,
          harassment, fraudulent bookings or interference with our systems.
        </p>
      </section>
      <section>
        <h2>Bookings and service availability</h2>
        <p>
          A submitted request is a request for service, subject to confirmation,
          technician availability, service coverage and appliance assessment.
          Preferred appointment times are not guaranteed until confirmed. Tell
          us about access restrictions, safety concerns and changes to your
          request. We may need to reschedule or decline work that cannot be
          performed safely or within the available service scope.
        </p>
      </section>
      <section>
        <h2>Assessment, pricing and payment</h2>
        <p>
          Inspection may be needed to identify the fault and determine suitable
          work or parts. Confirm the scope, estimated cost, any visit or
          diagnostic charge, applicable taxes and payment arrangements before
          authorizing work. Additional work or replacement parts should be
          discussed with you before proceeding. Pay only through a channel
          identified by FixBeez and retain the receipt or service record. Never
          share your Google password or banking one-time codes with a
          technician.
        </p>
      </section>
      <section>
        <h2>Cancellations, rescheduling and refunds</h2>
        <p>
          If you need to cancel or reschedule, use the available booking
          controls or contact support promptly. Any applicable cancellation,
          visit or diagnostic charge should be disclosed before you accept it.
          Contact support about incorrect charges, incomplete work or refund
          requests, providing the booking reference and relevant details. Refund
          eligibility depends on the service provided, the disclosed booking
          terms and applicable law; these terms do not impose a blanket
          no-refund policy.
        </p>
      </section>
      <section>
        <h2>Service access, parts and warranties</h2>
        <p>
          Provide safe access to the appliance and an authorized adult at the
          appointment. Back up information stored on an appliance where relevant
          and tell the technician about existing damage or previous repairs.
          Parts availability and manufacturer restrictions may affect the work
          that can be offered. Any specific service or parts warranty must be
          stated in your quotation or service record; do not assume a particular
          warranty period from these general terms.
        </p>
      </section>
      <section>
        <h2>Reviews, uploads and communications</h2>
        <p>
          Only submit material you are entitled to share. Keep reviews and
          support messages relevant, accurate and free of abusive or unlawful
          content. You permit FixBeez to use submitted material as needed to
          manage your request, provide support and display a review where that
          feature is offered. Do not upload sensitive documents unrelated to the
          service.
        </p>
      </section>
      <section>
        <h2>App availability and third-party services</h2>
        <p>
          Internet access is needed for sign-in, booking updates and most
          account actions. Cached content may be available offline but may not
          reflect the latest booking state. Maintenance, network problems and
          third-party services can interrupt access. Google Sign-In and other
          external services are subject to their own terms. Do not treat an
          unsent offline request as a confirmed booking.
        </p>
      </section>
      <section>
        <h2>Complaints and your legal rights</h2>
        <p>
          Contact support promptly if a service does not meet the agreed scope
          or you believe damage has occurred. Provide the booking reference and
          relevant evidence so the concern can be investigated. Nothing in these
          terms excludes rights or remedies that cannot lawfully be excluded
          under applicable consumer law. These terms are subject to applicable
          Indian law and do not remove your right to approach a competent
          consumer forum or other authority.
        </p>
      </section>
      <section>
        <h2>Changes and account restrictions</h2>
        <p>
          We may update these terms for future use of the service and will
          publish the updated date. Changes do not retrospectively remove rights
          attached to completed bookings. We may restrict misuse or unauthorized
          access, subject to applicable law; contact support if you believe a
          restriction is incorrect.
        </p>
      </section>
    </LegalPage>
  );
}
