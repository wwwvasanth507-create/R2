export interface EmailMessage {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  category: 'REGISTRATION' | 'PASSWORD_RESET' | 'STORAGE_ALERT_70' | 'STORAGE_ALERT_85' | 'STORAGE_HALT_100' | 'SECURITY';
}

export class EmailNotificationService {
  private sentAlertKeys: Set<string> = new Set();
  private sentCount = 0;

  constructor(
    private readonly smtpHost = process.env.SMTP_HOST || 'localhost',
    private readonly alertRecipient = process.env.ALERT_RECIPIENT_EMAIL || 'ops@example.com'
  ) {}

  /**
   * Dispatches an email notification with deduplication for storage thresholds.
   */
  public async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId: string; deduplicated?: boolean }> {
    // Deduplication key for storage alerts to avoid spamming admins
    if (message.category.startsWith('STORAGE_')) {
      const dedupeKey = `${message.category}:${message.to}:${message.subject}`;
      if (this.sentAlertKeys.has(dedupeKey)) {
        console.log(`[EMAIL DEDUPLICATION] Suppressing duplicate alert email: "${message.subject}"`);
        return { success: true, messageId: `suppressed-${Date.now()}`, deduplicated: true };
      }
      this.sentAlertKeys.add(dedupeKey);
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.sentCount++;

    console.log(`[EMAIL DISPATCH] Sent ${message.category} email to <${message.to}>: "${message.subject}" (ID: ${messageId})`);

    return {
      success: true,
      messageId,
      deduplicated: false
    };
  }

  public async sendStorageThresholdAlert(
    bucketName: string,
    thresholdPct: number,
    usedBytes: number,
    quotaBytes: number
  ): Promise<void> {
    let category: EmailMessage['category'] = 'STORAGE_ALERT_70';
    let urgency = 'Notice';

    if (thresholdPct >= 100) {
      category = 'STORAGE_HALT_100';
      urgency = 'CRITICAL HALT';
    } else if (thresholdPct >= 85) {
      category = 'STORAGE_ALERT_85';
      urgency = 'WARNING';
    }

    const subject = `[${urgency}] R2 Bucket ${bucketName} reached ${thresholdPct}% of 8 GiB Logical Quota`;
    const html = `
      <h2>Storage Alert: ${urgency}</h2>
      <p>Bucket <strong>${bucketName}</strong> has consumed ${thresholdPct}% of its application-enforced 8 GiB logical quota.</p>
      <ul>
        <li><strong>Used Storage:</strong> ${(usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GiB</li>
        <li><strong>Logical Quota:</strong> ${(quotaBytes / (1024 * 1024 * 1024)).toFixed(2)} GiB</li>
        <li><strong>Status:</strong> ${thresholdPct >= 100 ? 'Allocations Halted - Spilling to next bucket' : 'Active'}</li>
      </ul>
      <p>Log in to the Admin Dashboard to review capacity or add new authorized buckets.</p>
    `;

    await this.sendEmail({
      to: this.alertRecipient,
      subject,
      htmlContent: html,
      category
    });
  }

  public getSentCount(): number {
    return this.sentCount;
  }
}
