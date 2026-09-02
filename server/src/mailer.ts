import nodemailer, { type Transporter } from "nodemailer";
import dns from "dns";

let transporter: Transporter | null = null;

// Lazy init so the server can still boot before EMAIL_USER/EMAIL_APP_PASSWORD are configured.
// Render's outbound networking has no IPv6 route, and nodemailer doesn't honor a plain
// "family" option, so we resolve an IPv4 literal ourselves and connect to that directly
// (with `servername` set so TLS certificate validation still matches smtp.gmail.com).
async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    const [ipv4Address] = await dns.promises.resolve4("smtp.gmail.com");
    transporter = nodemailer.createTransport({
      host: ipv4Address,
      port: 465,
      secure: true,
      tls: { servername: "smtp.gmail.com" },
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendLoginLinkEmail(to: string, link: string): Promise<void> {
  const mailer = await getTransporter();
  await mailer.sendMail({
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

