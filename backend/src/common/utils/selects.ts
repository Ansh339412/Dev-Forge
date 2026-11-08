/** Safe public subset of a user; never select passwordHash. */
export const USER_BRIEF = { id: true, name: true, email: true, avatarUrl: true } as const;
