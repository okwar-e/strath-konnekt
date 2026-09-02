import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

let transporter: Transporter | null = null;

// Lazy init so the server can still boot before EMAIL_USER/EMAIL_APP_PASSWORD are configured.
function getTransporter(): Transporter {
  if (!transporter) {
    const options: SMTPTransport.Options & { family?: number } = {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      // Render's outbound networking can't route IPv6 to Gmail's mail servers;
      // force IPv4 to avoid ENETUNREACH connecting to smtp.gmail.com.
      family: 4,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    };
    transporter = nodemailer.createTransport(options);
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
