import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentServiceHttpClient {
  private readonly logger = new Logger(PaymentServiceHttpClient.name);
  private readonly primaryBaseUrl: string;
  private readonly fallbackBaseUrl?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.primaryBaseUrl = this.normalizeBaseUrl(
      this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:8002'),
    );

    const configuredFallback =
      this.configService.get<string>('PAYMENT_SERVICE_FALLBACK_URL')
      || this.configService.get<string>('PAYMENT_SERVICE_PUBLIC_URL');

    const normalizedFallback = configuredFallback
      ? this.normalizeBaseUrl(configuredFallback)
      : undefined;

    this.fallbackBaseUrl = normalizedFallback && normalizedFallback !== this.primaryBaseUrl
      ? normalizedFallback
      : undefined;
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url: path });
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url: path, data });
  }

  async put<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url: path, data });
  }

  async patch<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url: path, data });
  }

  async delete<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url: path });
  }

  private async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const targets = [this.primaryBaseUrl, this.fallbackBaseUrl].filter(
      (url): url is string => Boolean(url),
    );

    let lastError: unknown;

    for (let index = 0; index < targets.length; index += 1) {
      const baseUrl = targets[index];
      const requestConfig = {
        ...config,
        url: this.resolveUrl(baseUrl, config.url),
      } satisfies AxiosRequestConfig;

      try {
        return await firstValueFrom(this.httpService.request<T>(requestConfig));
      } catch (error) {
        lastError = error;

        const canRetry = index < targets.length - 1 && this.isRetryableNetworkError(error);
        if (!canRetry) {
          throw error;
        }

        this.logger.warn(
          `Payment service request to ${baseUrl} failed with ${this.describeError(error)}. Retrying with ${targets[index + 1]}`,
        );
      }
    }

    throw lastError;
  }

  private resolveUrl(baseUrl: string, path?: string): string {
    if (!path) {
      return baseUrl;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private isRetryableNetworkError(error: unknown): boolean {
    const code = this.extractErrorCode(error);
    return ['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(code);
  }

  private extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === 'string' ? code : '';
    }

    return '';
  }

  private describeError(error: unknown): string {
    const code = this.extractErrorCode(error);
    if (code) {
      return code;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      return typeof message === 'string' ? message : 'unknown error';
    }

    return 'unknown error';
  }
}