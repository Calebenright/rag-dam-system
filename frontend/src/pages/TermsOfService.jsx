import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-3xl font-bold text-neutral-50 mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500 mb-10">Last updated: April 2, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-300">
          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Dodeka Internal platform (the "Service") operated by Dodeka
              Digital ("we", "us", "our"), you agree to be bound by these Terms of Service. If you do
              not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">2. Description of Service</h2>
            <p>
              The Service is an internal platform for managing client accounts, generating advertising
              copy using AI, storing and retrieving source documents, and facilitating advertising
              workflows across platforms including Google, Meta (Facebook/Instagram), LinkedIn, and Reddit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">3. Access and Accounts</h2>
            <ul className="list-disc list-inside mt-2 space-y-2 text-neutral-400">
              <li>Access is restricted to authorized Dodeka Digital team members with valid @dodekadigital.com Google Workspace accounts.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must not share your access or allow unauthorized individuals to use the Service.</li>
              <li>We reserve the right to suspend or terminate access at any time without prior notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-2 text-neutral-400">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations</li>
              <li>Upload malicious content, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
              <li>Use the Service to generate content that violates the advertising policies of Meta, Google, LinkedIn, Reddit, or any other platform</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools to scrape or extract data from the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">5. Client Data and Content</h2>
            <ul className="list-disc list-inside mt-2 space-y-2 text-neutral-400">
              <li>You retain ownership of all client data and content uploaded to the Service.</li>
              <li>You grant us a limited license to process, store, and transmit your content solely for the purpose of providing the Service.</li>
              <li>You are responsible for ensuring you have the necessary rights and permissions to upload and process client data.</li>
              <li>AI-generated ad copy is provided as suggestions. You are responsible for reviewing and approving all content before publishing to any advertising platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">6. Third-Party Platform Compliance</h2>
            <p>When using the Service to generate content for third-party advertising platforms:</p>
            <ul className="list-disc list-inside mt-2 space-y-2 text-neutral-400">
              <li>You are responsible for ensuring all generated content complies with the respective platform's advertising policies and community standards.</li>
              <li>We do not guarantee that generated content will be approved by Meta, Google, LinkedIn, Reddit, or any other platform.</li>
              <li>Use of Meta platform data (if any) is subject to Meta's Platform Terms and Developer Policies.</li>
              <li>We will not use any data obtained through Meta integrations for purposes other than providing the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">7. AI-Generated Content</h2>
            <ul className="list-disc list-inside mt-2 space-y-2 text-neutral-400">
              <li>Ad copy and other content generated by the Service's AI features are provided "as-is" without warranty of accuracy, originality, or fitness for a particular purpose.</li>
              <li>You must review all AI-generated content before use and accept full responsibility for any content you publish.</li>
              <li>We are not liable for any claims, damages, or losses arising from the use of AI-generated content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">8. Intellectual Property</h2>
            <p>
              The Service, including its design, code, features, and branding, is the property of
              Dodeka Digital. Nothing in these terms grants you any rights to our intellectual property
              except the limited right to use the Service as authorized.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">9. Data Deletion</h2>
            <p>
              You may request deletion of your data or any client data at any time. Upon receiving a
              valid deletion request, we will remove the specified data from our active systems within
              30 days. Some data may persist in backups for a limited period but will not be actively
              used or accessible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Dodeka Digital shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of
              profits or revenues, whether incurred directly or indirectly, or any loss of data, use,
              goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">11. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an "as-is" and "as-available" basis. We make no warranties,
              expressed or implied, regarding the Service's reliability, availability, or suitability
              for any purpose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective
              immediately upon posting. Your continued use of the Service after changes constitutes
              acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Australia,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">14. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="mt-2 text-neutral-200">
              Dodeka Digital<br />
              Email: legal@dodekadigital.com
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
