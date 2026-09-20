import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';

export type RazorpayCreatedOrder = {
  id: string;
  amount: number;
  currency: string;
};

@Injectable()
export class RazorpayService {
  isConfigured() {
    return Boolean(this.keyId() && this.keySecret());
  }

  keyId() {
    return process.env.RAZORPAY_KEY_ID?.trim() || '';
  }

  private keySecret() {
    return process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  }

  async createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayCreatedOrder> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Online payment is not available yet. Please choose cash on delivery, or try again in a moment.',
      );
    }

    const auth = Buffer.from(`${this.keyId()}:${this.keySecret()}`).toString(
      'base64',
    );
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: 'INR',
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(
        'Online payment is not available yet. Please choose cash on delivery, or try again in a moment.',
      );
    }

    const json = (await res.json()) as {
      id?: string;
      amount?: number;
      currency?: string;
    };
    if (!json.id) {
      throw new BadRequestException(
        'Online payment is not available yet. Please choose cash on delivery, or try again in a moment.',
      );
    }

    return {
      id: json.id,
      amount: Number(json.amount) || input.amountPaise,
      currency: json.currency || 'INR',
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string) {
    const secret = this.keySecret();
    if (!secret) return false;
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
