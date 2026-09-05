import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminRole, AdminUserPublic, JwtPayload } from './auth.types';

const DEFAULT_ADMIN_NAME = 'Baby Pleats Admin';
const BCRYPT_ROUNDS = 10;

function parseExpiresInSeconds(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = /^(\d+)([smhd])?$/i.exec(trimmed);
  if (!match) {
    const asNum = Number(trimmed);
    return Number.isFinite(asNum) && asNum > 0 ? asNum : 8 * 60 * 60;
  }
  const value = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return value * (multipliers[unit] ?? 1);
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    await this.ensureSeedAdmin();
  }

  async ensureSeedAdmin(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name =
      process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;

    if (!email || !password) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the owner account',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.prisma.adminUser.upsert({
      where: { email },
      create: {
        email,
        name,
        role: 'owner',
        passwordHash,
      },
      update: {
        name,
        role: 'owner',
        passwordHash,
      },
    });
  }

  toPublic(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }): AdminUserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AdminRole,
    };
  }

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.adminUser.findUnique({
      where: { email: normalized },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const expiresInEnv = process.env.JWT_EXPIRES_IN?.trim() || '8h';
    const expiresIn = parseExpiresInSeconds(expiresInEnv);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as AdminRole,
    };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      expiresIn,
      user: this.toPublic(user),
    };
  }

  async getUserById(id: string): Promise<AdminUserPublic | null> {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    return user ? this.toPublic(user) : null;
  }
}
