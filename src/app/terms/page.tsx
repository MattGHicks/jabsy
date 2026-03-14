import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Jabsy — Fantasy MMA Picks',
}

export default function TermsPage() {
  const lastUpdated = 'March 13, 2026'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f5]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-2xl font-black text-[#e11d48] tracking-wide block mb-12"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
        >
          JABSY
        </Link>

        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#71717a] mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-[#a1a1aa] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Jabsy ("the App"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">2. Description of Service</h2>
            <p>
              Jabsy is a fantasy MMA picks platform that allows users to predict UFC fight
              outcomes, join private leagues, and compete with friends. The App is provided for
              entertainment purposes only. No real money or prizes are involved.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">3. Account Registration</h2>
            <p className="mb-3">To use Jabsy, you must:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Be at least 13 years of age</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="mt-3">
              You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Use the App for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the App or its infrastructure</li>
              <li>Impersonate any person or entity</li>
              <li>Submit false or misleading information</li>
              <li>Interfere with or disrupt the integrity or performance of the App</li>
              <li>Use automated means to access the App without our written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">5. Picks and Scoring</h2>
            <p>
              Fight picks are submitted before an event locks. Once an event locks, picks cannot
              be changed. Scores are calculated automatically based on official UFC results.
              We reserve the right to correct scoring errors at any time. Jabsy is not
              responsible for errors in third-party data sources used to determine results.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibent text-[#f4f4f5] mb-3">6. Leagues and Invitations</h2>
            <p>
              League commissioners are responsible for managing their leagues. Jabsy is not
              responsible for disputes between league members. We reserve the right to remove
              any league or user that violates these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">7. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the App — including but not limited to
              text, graphics, logos, and software — are owned by Jabsy and are protected by
              applicable intellectual property laws. You may not reproduce, distribute, or create
              derivative works without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The App is provided "as is" without warranties of any kind, either express or
              implied. We do not warrant that the App will be uninterrupted, error-free, or free
              of harmful components. Use of the App is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Jabsy and its operators shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your
              use of or inability to use the App, even if we have been advised of the possibility
              of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation
              of these Terms or for any other reason at our sole discretion. You may also delete
              your account at any time from your profile settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. We will notify users of material changes by
              posting the updated Terms with a new effective date. Continued use of the App after
              changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States. Any disputes arising
              from these Terms or your use of the App shall be resolved through binding
              arbitration or in the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">13. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at{' '}
              <a
                href="mailto:mattghicks@gmail.com"
                className="text-[#e11d48] hover:underline"
              >
                mattghicks@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1e1e1e] flex gap-6 text-sm text-[#52525b]">
          <Link href="/privacy" className="hover:text-[#a1a1aa] transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-[#a1a1aa] transition-colors">Back to Jabsy</Link>
        </div>
      </div>
    </div>
  )
}
