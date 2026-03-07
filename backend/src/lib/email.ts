/**
 * Password reset email. Uses Resend when RESEND_API_KEY is set; otherwise logs link (dev).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM ?? 'Body Fat Tracker <onboarding@resend.dev>';

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (RESEND_API_KEY && RESEND_API_KEY.length > 0) {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Reset your Body Fat Tracker password',
      html: `<p>You requested a password reset. Click the link below to set a new password (link expires in 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });
    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send reset email');
    }
  } else {
    console.log('[Dev] Password reset link for', to, ':', resetLink);
  }
}

export async function sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
  if (RESEND_API_KEY && RESEND_API_KEY.length > 0) {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Verify your Body Fat Tracker email',
      html: `<p>Welcome! Please verify your email by clicking the link below (link expires in 24 hours):</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>If you didn't create an account, you can ignore this email.</p>`,
    });
    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send verification email');
    }
  } else {
    console.log('[Dev] Verification link for', to, ':', verifyLink);
  }
}
