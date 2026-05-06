export type EmailTemplatePreset = {
  type: string;
  label: string;
  description: string;
  usedFor: string;
  variables: string[];
  defaultSubject: string;
  defaultBody: string;
};

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  {
    type: "welcome",
    label: "Welcome Email",
    description: "Sent after a user finishes registration or verifies their email, depending on the auth flow.",
    usedFor: "User onboarding",
    variables: ["{{name}}", "{{brand.name}}", "{{loginUrl}}"],
    defaultSubject: "Welcome to {{brand.name}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>Welcome to {{brand.name}}. Your account is ready and you can sign in anytime from the link below.</p><p><a href=\"{{loginUrl}}\">Go to login</a></p><p>We are excited to have you with us.</p>",
  },
  {
    type: "email_verification",
    label: "Email Verification",
    description: "Sent when a user needs to confirm their email address.",
    usedFor: "Account verification",
    variables: ["{{name}}", "{{brand.name}}", "{{verificationUrl}}"],
    defaultSubject: "Verify your email for {{brand.name}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>Please verify your email address to continue with {{brand.name}}.</p><p><a href=\"{{verificationUrl}}\">Verify email</a></p><p>If you did not request this, you can ignore this message.</p>",
  },
  {
    type: "email_verified",
    label: "Email Verified Confirmation",
    description: "Sent after the email verification process succeeds.",
    usedFor: "Verification confirmation",
    variables: ["{{name}}", "{{brand.name}}", "{{loginUrl}}"],
    defaultSubject: "Your email has been verified",
    defaultBody:
      "<p>Hi {{name}},</p><p>Your email for {{brand.name}} has been verified successfully.</p><p><a href=\"{{loginUrl}}\">Sign in now</a></p>",
  },
  {
    type: "password_reset",
    label: "Password Reset",
    description: "Sent when a user requests a password reset link.",
    usedFor: "Password recovery",
    variables: ["{{name}}", "{{brand.name}}", "{{resetUrl}}"],
    defaultSubject: "Reset your password",
    defaultBody:
      "<p>Hi {{name}},</p><p>We received a request to reset your password for {{brand.name}}.</p><p><a href=\"{{resetUrl}}\">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>",
  },
  {
    type: "payment_received",
    label: "Payment Confirmation",
    description: "Sent when a payment has been completed successfully.",
    usedFor: "Successful payment notification",
    variables: ["{{name}}", "{{amount}}", "{{currency}}", "{{orderId}}", "{{date}}", "{{invoiceUrl}}"],
    defaultSubject: "Payment confirmed for {{orderId}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>We have received your payment of {{currency}} {{amount}}.</p><p>Reference: <strong>{{orderId}}</strong></p><p>Date: {{date}}</p><p><a href=\"{{invoiceUrl}}\">View invoice</a></p>",
  },
  {
    type: "manual_payment_received",
    label: "Manual Payment Proof Received",
    description: "Sent after a participant uploads manual transfer proof for review.",
    usedFor: "Pending manual payment review",
    variables: ["{{name}}", "{{amount}}", "{{currency}}", "{{orderId}}", "{{date}}"],
    defaultSubject: "We received your payment proof",
    defaultBody:
      "<p>Hi {{name}},</p><p>We have received your payment proof for {{currency}} {{amount}}.</p><p>Reference: <strong>{{orderId}}</strong></p><p>Submitted on {{date}}. Our team will review it shortly.</p>",
  },
  {
    type: "payment_failed",
    label: "Payment Failed",
    description: "Sent when a payment attempt fails and the user needs to retry.",
    usedFor: "Failed payment notification",
    variables: ["{{name}}", "{{amount}}", "{{currency}}", "{{orderId}}", "{{date}}", "{{reason}}", "{{retryUrl}}"],
    defaultSubject: "Payment failed for {{orderId}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>Your payment attempt for {{currency}} {{amount}} could not be completed.</p><p>Reference: <strong>{{orderId}}</strong></p><p>Reason: {{reason}}</p><p><a href=\"{{retryUrl}}\">Try again</a></p>",
  },
  {
    type: "payment_refunded",
    label: "Payment Refunded",
    description: "Sent when a payment refund is processed.",
    usedFor: "Refund confirmation",
    variables: ["{{name}}", "{{amount}}", "{{currency}}", "{{orderId}}", "{{date}}", "{{description}}"],
    defaultSubject: "Refund processed for {{orderId}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>Your refund for {{currency}} {{amount}} has been processed.</p><p>Reference: <strong>{{orderId}}</strong></p><p>{{description}}</p><p>Date: {{date}}</p>",
  },
  {
    type: "support_ticket_created",
    label: "Support Ticket Created",
    description: "Sent when a participant creates a new support ticket.",
    usedFor: "Support acknowledgement",
    variables: ["{{name}}", "{{ticketNumber}}", "{{subject}}", "{{category}}", "{{subCategory}}", "{{priority}}", "{{status}}", "{{supportUrl}}", "{{brand.name}}"],
    defaultSubject: "Support ticket received ({{ticketNumber}})",
    defaultBody:
      "<p>Hi {{name}},</p><p>We received your support request for {{brand.name}}.</p><p>Ticket number: <strong>{{ticketNumber}}</strong></p><p>Subject: {{subject}}</p><p><a href=\"{{supportUrl}}\">View support ticket</a></p>",
  },
  {
    type: "support_ticket_replied",
    label: "Support Ticket Reply",
    description: "Sent when the support team replies to a ticket.",
    usedFor: "Support reply notification",
    variables: ["{{name}}", "{{ticketNumber}}", "{{subject}}", "{{status}}", "{{responderName}}", "{{messagePreview}}", "{{supportUrl}}", "{{brand.name}}"],
    defaultSubject: "New reply for support ticket {{ticketNumber}}",
    defaultBody:
      "<p>Hi {{name}},</p><p>{{responderName}} has replied to your support ticket for {{brand.name}}.</p><p>Ticket number: <strong>{{ticketNumber}}</strong></p><p>{{messagePreview}}</p><p><a href=\"{{supportUrl}}\">Open ticket</a></p>",
  },
  {
    type: "support_ticket_status_updated",
    label: "Support Ticket Status Update",
    description: "Sent when the status of a support ticket changes.",
    usedFor: "Support status update",
    variables: ["{{name}}", "{{ticketNumber}}", "{{subject}}", "{{previousStatus}}", "{{status}}", "{{supportUrl}}", "{{brand.name}}"],
    defaultSubject: "Support ticket {{ticketNumber}} status updated",
    defaultBody:
      "<p>Hi {{name}},</p><p>Your support ticket for {{brand.name}} has been updated.</p><p>Ticket number: <strong>{{ticketNumber}}</strong></p><p>Status changed from <strong>{{previousStatus}}</strong> to <strong>{{status}}</strong>.</p><p><a href=\"{{supportUrl}}\">Review update</a></p>",
  },
];

export function getEmailTemplatePreset(type?: string | null): EmailTemplatePreset | null {
  if (!type) return null;
  return EMAIL_TEMPLATE_PRESETS.find((preset) => preset.type === type) ?? null;
}
