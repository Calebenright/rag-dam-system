import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-3xl font-bold text-neutral-50 mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-10">Last updated: April 2, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-300">
          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">1. Introduction</h2>
            <p>
              Dodeka Digital ("we", "us", "our") operates the Dodeka Internal platform (the "Service").
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our Service, including any features that integrate with third-party platforms
              such as Meta (Facebook/Instagram), Google, LinkedIn, and Reddit.
            </p>
            <p className="mt-2">
              By using the Service, you agree to the collection and use of information in accordance with
              this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">2. Information We Collect</h2>

            <h3 className="font-medium text-neutral-200 mt-4 mb-2">2.1 Account Information</h3>
            <p>When you sign in with your Google Workspace account, we receive:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Name and email address (restricted to @dodekadigital.com accounts)</li>
              <li>Google profile photo (if available)</li>
            </ul>

            <h3 className="font-medium text-neutral-200 mt-4 mb-2">2.2 Client Data</h3>
            <p>Data you upload or create within the Service:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Client names, descriptions, and branding assets (thumbnails)</li>
              <li>Source documents uploaded for ad copy generation</li>
              <li>Generated ad copy, creative directions, and copy preferences</li>
              <li>Chat messages with the AI assistant</li>
            </ul>

            <h3 className="font-medium text-neutral-200 mt-4 mb-2">2.3 Third-Party Platform Data</h3>
            <p>
              When using features related to Meta, Google, LinkedIn, or Reddit advertising platforms,
              we may process ad copy content formatted for those platforms. We do not access your
              advertising accounts, campaigns, or analytics data on those platforms directly.
            </p>

            <h3 className="font-medium text-neutral-200 mt-4 mb-2">2.4 Usage Data</h3>
            <p>We automatically collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Device information (operating system, screen resolution)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Provide and maintain the Service</li>
              <li>Authenticate users and restrict access to authorized team members</li>
              <li>Generate and optimize ad copy using AI models</li>
              <li>Store client data and documents for retrieval and search</li>
              <li>Improve the Service and develop new features</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">4. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li><strong className="text-neutral-200">AI Service Providers:</strong> We send client source content and prompts to OpenAI for ad copy generation. This data is processed per OpenAI's data usage policies and is not used to train their models.</li>
              <li><strong className="text-neutral-200">Infrastructure Providers:</strong> We use Supabase (database/auth), Railway (hosting), and Google Cloud services to operate the platform.</li>
              <li><strong className="text-neutral-200">Google Sheets:</strong> Generated ad copy may be exported to Google Sheets at your direction.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-neutral-200">not</strong> sell, rent, or trade your personal information or client
              data to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">5. Meta Platform Data</h2>
            <p>
              In connection with Meta (Facebook/Instagram) platform features:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>We do not receive, store, or process data directly from Meta's APIs or user profiles beyond what is described in this policy.</li>
              <li>Ad copy generated for Meta platforms is created locally within our Service and is not automatically published to Meta.</li>
              <li>We do not use Meta Pixel, Conversions API, or any Meta tracking technologies within the Service.</li>
              <li>Any data obtained through Meta platform integrations will be used solely for the purposes described in this policy and will be deleted upon request.</li>
              <li>We will not transfer Meta platform data to any third party without your explicit consent, except as required to provide the Service or by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the
              Service. Client data (documents, ad copy, chat history) is retained until explicitly
              deleted by an authorized user. You may request deletion of your data at any time by
              contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data,
              including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Encryption in transit (TLS/HTTPS) and at rest</li>
              <li>Access restricted to authenticated @dodekadigital.com accounts</li>
              <li>Infrastructure hosted on secure, SOC 2 compliant platforms</li>
              <li>Regular security reviews</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-neutral-400">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">9. Children's Privacy</h2>
            <p>
              The Service is not intended for use by individuals under the age of 18. We do not
              knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2 text-neutral-200">
              Dodeka Digital<br />
              Email: privacy@dodekadigital.com
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 text-xs text-neutral-500">
          <Link to="/terms" className="hover:text-neutral-300 transition-colors">Terms of Service</Link>
          <span className="mx-2">|</span>
          <Link to="/privacy" className="hover:text-neutral-300 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
