import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { getEmailTemplate, handlerNodeMailerError } from "../utils/email.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: env.GMAIL_USER_EMAIL,
      clientId: env.GMAIL_CLIENT_ID,
      clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN,
    },
  });
  return transporter;
}

export async function verifyMailTransporter(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info("Mail transporter verified successfully.");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Mail transporter verification failed.");
    return false;
  }
}

export const sendOtpMail = async (email: string, otp: string): Promise<void> => {
  const subject = "Your SyntheView OTP";
  try {
    await getTransporter().sendMail({
      from: env.GMAIL_USER_EMAIL,
      to: email,
      subject,
      html: getEmailTemplate(otp, email, subject),
    });
  } catch (error) {
    handlerNodeMailerError(error);
  }
};
