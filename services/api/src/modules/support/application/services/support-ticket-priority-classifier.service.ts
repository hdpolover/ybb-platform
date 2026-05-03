import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ClassifiedPriority = 'low' | 'normal' | 'high';

type ClassificationResult = {
  priority: ClassifiedPriority;
  confidence: number;
  reason: string;
  source: 'ai' | 'fallback';
  model: string;
};

@Injectable()
export class SupportTicketPriorityClassifierService {
  private readonly logger = new Logger(SupportTicketPriorityClassifierService.name);
  private readonly endpointBase = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private readonly configService: ConfigService) {}

  async classify(input: {
    category: string;
    subCategory?: string;
    subject: string;
    description: string;
  }): Promise<ClassificationResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (!apiKey) {
      return {
        priority: 'normal',
        confidence: 0,
        reason: 'GEMINI_API_KEY is not configured',
        source: 'fallback',
        model,
      };
    }

    const prompt = [
      'You are a support triage classifier for a youth program platform.',
      'Classify ticket priority as low, normal, or high.',
      'Rules:',
      '- high: payment blocked, account lockout, critical deadline risk, cannot submit required documents, security issues, widespread outage.',
      '- normal: standard functional issues, confusing flow, issues with workaround, schedule clarification that is time-sensitive.',
      '- low: general inquiries, minor cosmetic issues, non-urgent requests.',
      'Return ONLY valid JSON with this exact shape:',
      '{"priority":"low|normal|high","confidence":0.0-1.0,"reason":"short reason"}',
      '',
      `category: ${input.category}`,
      `subCategory: ${input.subCategory ?? '-'}`,
      `subject: ${input.subject}`,
      `description: ${this.stripHtml(input.description)}`,
    ].join('\n');

    try {
      const response = await fetch(
        `${this.endpointBase}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 1,
              maxOutputTokens: 256,
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) {
        const failureBody = await response.text();
        this.logger.warn(`Gemini classification failed with ${response.status}: ${failureBody}`);
        return {
          priority: 'normal',
          confidence: 0,
          reason: 'Gemini request failed',
          source: 'fallback',
          model,
        };
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      const parsed = this.parseModelJson(rawText);
      if (!parsed) {
        this.logger.warn(`Gemini returned unparseable JSON: ${rawText}`);
        return {
          priority: 'normal',
          confidence: 0,
          reason: 'Gemini response was not parseable JSON',
          source: 'fallback',
          model,
        };
      }

      const validatedPriority = this.normalizePriority(parsed.priority);
      if (!validatedPriority) {
        return {
          priority: 'normal',
          confidence: 0,
          reason: 'Gemini priority was invalid',
          source: 'fallback',
          model,
        };
      }

      return {
        priority: validatedPriority,
        confidence: this.normalizeConfidence(parsed.confidence),
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 400) : 'Priority classified by Gemini',
        source: 'ai',
        model,
      };
    } catch (error) {
      this.logger.warn(`Gemini classification error: ${(error as Error).message}`);
      return {
        priority: 'normal',
        confidence: 0,
        reason: 'Gemini classification threw an exception',
        source: 'fallback',
        model,
      };
    }
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private parseModelJson(rawText: string): Record<string, unknown> | null {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizePriority(value: unknown): ClassifiedPriority | null {
    if (typeof value !== 'string') return null;
    const lowered = value.trim().toLowerCase();
    if (lowered === 'low' || lowered === 'normal' || lowered === 'high') {
      return lowered;
    }
    if (lowered === 'urgent') return 'high';
    return null;
  }

  private normalizeConfidence(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(1, value));
    }
    return 0;
  }
}
