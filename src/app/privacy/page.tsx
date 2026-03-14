import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Jabsy — Fantasy MMA Picks',
}

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#71717a] mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-[#a1a1aa] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">1. Overview</h2>
            <p>
              Jabsy ("we", "us", or "our") is a fantasy MMA picks app that lets you compete with
              friends by predicting fight outcomes. This Privacy Policy explains what information we
              collect, how we use it, and your rights regarding that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <span className="text-[#f4f4f5] font-medium">Account information</span> — your
                name, email address, and profile picture provided via Google Sign-In or email
                registration.
              </li>
              <li>
                <span className="text-[#f4f4f5] font-medium">Picks and activity</span> — the fight
                predictions you submit, your league memberships, and scores.
              </li>
              <li>
                <span className="text-[#f4f4f5] font-medium">Usage data</span> — pages visited,
                actions taken within the app, and timestamps (collected via Vercel Analytics).
              </li>
              <li>
                <span className="text-[#f4f4f5] font-medium">Device information</span> — browser
                type, operating system, and IP address for security and analytics purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Create and manage your account</li>
              <li>Display your picks, scores, and leaderboard rankings</li>
              <li>Enable league creation, invitations, and competition</li>
              <li>Send transactional emails (e.g. invites, score updates)</li>
              <li>Improve and maintain the app</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">4. Third-Party Services</h2>
            <p className="mb-3">We rely on the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <span className="text-[#f4f4f5] font-medium">Supabase</span> — database and
                authentication hosting
              </li>
              <li>
                <span className="text-[#f4f4f5] font-medium">Google OAuth</span> — optional
                sign-in via your Google account
              </li>
              <li>
                <span className="text-[#f4f4f5] font-medium">Vercel</span> — app hosting and
                analytics
              </li>
            </ul>
            <p className="mt-3">
              Each of these services has its own privacy policy governing how they handle data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">5. Data Sharing</h2>
            <p>
              We do not sell, rent, or share your personal information with third parties for
              marketing purposes. Your information may be shared only as required by law or to
              protect the rights and safety of our users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You may request
              deletion of your account and associated data at any time by contacting us. Pick
              history and league data associated with your account will be anonymized or removed
              upon deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Withdraw consent for optional data uses at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">8. Security</h2>
            <p>
              We use industry-standard security practices including encrypted data transmission
              (HTTPS), secure authentication, and access controls. However, no method of
              transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Jabsy is not intended for users under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided us
              with their information, please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes by posting the new policy on this page with an updated date.
              Continued use of Jabsy after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#f4f4f5] mb-3">11. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy, please contact us
              at{' '}
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
          <Link href="/terms" className="hover:text-[#a1a1aa] transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-[#a1a1aa] transition-colors">Back to Jabsy</Link>
        </div>
      </div>
    </div>
  )
}
