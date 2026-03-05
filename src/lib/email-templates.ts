// Email templates for Healify
// Used for transactional emails like welcome, notifications, etc.

interface EmailTemplate {
  subject: string
  html: string
}

interface WelcomeParams {
  name?: string
}

export function emailWelcome(params: WelcomeParams): EmailTemplate {
  const displayName = params.name || 'User'

  return {
    subject: 'Welcome to Healify!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Healify</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f8fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f8fa; padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="padding: 32px 40px; border-bottom: 1px solid #eaecef;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1f2937;">Healify</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">Tests that heal themselves</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937;">
                  Welcome, ${displayName}!
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                  Thank you for joining Healify. We're excited to help you automate the fixing of your failing E2E tests.
                </p>
                <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                  With Healify, when your tests fail due to UI changes, our AI will automatically:
                </p>
                <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #374151; line-height: 1.8;">
                  <li>Detect what broke</li>
                  <li>Generate a fix for the selector</li>
                  <li>Open a Pull Request automatically</li>
                </ul>
                <p style="margin: 0;">
                  <a href="https://healify.app/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px;">
                    Get Started
                  </a>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px; border-top: 1px solid #eaecef; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                  © ${new Date().getFullYear()} Healify. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim(),
  }
}
