import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

// Lazy init so the server can still boot before EMAIL_USER/EMAIL_APP_PASSWORD are configured.
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendLoginLinkEmail(to: string, link: string): Promise<void> {
  await getTransporter().sendMail({
    from: `"Strath Konnekt" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Strath Konnekt sign-in link",
    html: `
      <p>Tap the link below to sign in to Strath Konnekt:</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
