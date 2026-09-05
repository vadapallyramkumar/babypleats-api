export type AdminRole = 'owner' | 'staff';

export type AdminUserPublic = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: AdminRole;
};
