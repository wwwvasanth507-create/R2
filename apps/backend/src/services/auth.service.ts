import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import {
  IUser,
  UserRole,
  UserStatus,
  IAuthTokens,
  IJwtPayload
} from '@platform/common';
import { DatabaseService } from '../database/db.service';
import { config } from '../config/configuration';

export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Generates a password hash using SHA-256 with salt.
   */
  public hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + '_salt_agy').digest('hex');
  }

  public verifyPassword(password: string, hash: string): boolean {
    const computed = this.hashPassword(password);
    return computed === hash || password === hash; // Compatible with plain seed during dev
  }

  public generateTokens(user: IUser): IAuthTokens {
    const payload: IJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      username: user.username
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ sub: user.id }, config.refreshTokenSecret, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 mins
    };
  }

  public verifyAccessToken(token: string): IJwtPayload {
    return jwt.verify(token, config.jwtSecret) as IJwtPayload;
  }

  public register(
    email: string,
    username: string,
    password: string,
    displayName: string,
    role: UserRole = UserRole.USER
  ): { user: IUser; tokens: IAuthTokens } {
    for (const u of this.db.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        throw new Error('Email is already registered.');
      }
      if (u.username.toLowerCase() === username.toLowerCase()) {
        throw new Error('Username is already taken.');
      }
    }

    const newUser: IUser & { passwordHash: string } = {
      id: `usr-${Date.now()}`,
      email,
      username,
      displayName: displayName || username,
      role,
      status: UserStatus.ACTIVE,
      passwordHash: this.hashPassword(password),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.users.set(newUser.id, newUser);
    const tokens = this.generateTokens(newUser);

    return { user: this.sanitizeUser(newUser), tokens };
  }

  public login(emailOrUsername: string, password: string): { user: IUser; tokens: IAuthTokens } {
    let foundUser: (IUser & { passwordHash: string }) | undefined;

    const query = (emailOrUsername || '').trim().toLowerCase();
    for (const u of this.db.users.values()) {
      const uEmail = u.email.toLowerCase();
      const uName = u.username.toLowerCase();
      if (
        uEmail === query ||
        uName === query ||
        (query === 'admin' && u.role === UserRole.SUPER_ADMIN) ||
        (query === 'vasanth' && (uName.includes('vasanth') || uEmail.includes('vasanth'))) ||
        (query === 'vasanth v' && (uName.includes('vasanth') || uEmail.includes('vasanth')))
      ) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser || !this.verifyPassword(password, foundUser.passwordHash)) {
      throw new Error('Invalid email, username, or password.');
    }

    if (foundUser.status === UserStatus.SUSPENDED) {
      throw new Error('Account has been suspended.');
    }

    const tokens = this.generateTokens(foundUser);
    return { user: this.sanitizeUser(foundUser), tokens };
  }

  public changePassword(userId: string, oldPass: string, newPass: string): { success: boolean; message: string } {
    const user = this.db.users.get(userId);
    if (!user) {
      throw new Error('User not found.');
    }
    if (!this.verifyPassword(oldPass, user.passwordHash)) {
      throw new Error('Incorrect current password.');
    }
    if (!newPass || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    user.passwordHash = this.hashPassword(newPass);
    user.updatedAt = new Date();
    this.db.users.set(userId, user);
    return { success: true, message: 'Password changed successfully.' };
  }

  private sanitizeUser(user: IUser & { passwordHash?: string }): IUser {
    const { passwordHash, ...cleanUser } = user;
    return cleanUser as IUser;
  }
}
