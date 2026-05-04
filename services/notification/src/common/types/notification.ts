// Shared TypeScript types for Notification entities

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Email template types
export enum EmailTemplate {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  APPLICATION_SUBMITTED = 'application_submitted',
  APPLICATION_ACCEPTED = 'application_accepted',
  APPLICATION_REJECTED = 'application_rejected',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  PROGRAM_REMINDER = 'program_reminder',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  subject: string;
  content: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendEmailDto {
  to: string;
  template: EmailTemplate;
  subject?: string;
  data: Record<string, any>;
  priority?: NotificationPriority;
}

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  subject: string;
  content: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

// RabbitMQ event payloads
export interface PaymentEventPayload {
  paymentId: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  programTitle: string;
  status: string;
}

export interface ApplicationEventPayload {
  applicationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  programTitle: string;
  status: string;
  reviewNotes?: string;
}

export interface UserEventPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  verificationToken?: string;
  resetToken?: string;
}
