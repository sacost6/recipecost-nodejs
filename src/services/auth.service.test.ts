import * as argon2 from 'argon2';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import { getUserService, loginService, registerService } from './auth.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const query = vi.hoisted(() => ({
  addSelect: vi.fn(),
  where: vi.fn(),
  getOne: vi.fn(),
}));

// Isolate database access, including data-source/environment initialization.
vi.mock('../repositories/users.repo', () => ({ userRepository: repository }));

// Keep real hashing/verification by default, with failure injection per test.
vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return {
    ...actual,
    hash: vi.fn(actual.hash),
    verify: vi.fn(actual.verify),
  };
});

const credentials = {
  email: 'alice@example.com',
  password: '  An Exact Test Password  ',
};
const publicUser = { userId: '9007199254740993', email: credentials.email };
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await argon2.hash(credentials.password);
});

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((input) => input);
  repository.createQueryBuilder.mockReturnValue(query);
  query.addSelect.mockReturnValue(query);
  query.where.mockReturnValue(query);
});

const savedUser = () => ({
  ...publicUser,
  passwordHash,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('registerService', () => {
  it('persists an Argon2id hash that verifies the exact password and returns only public fields', async () => {
    repository.save.mockImplementation(async (input) => ({
      ...savedUser(),
      ...input,
    }));

    const result = await registerService(credentials);
    const stored = repository.save.mock.calls[0][0] as {
      email: string;
      passwordHash: string;
    };

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(Object.keys(stored).sort()).toEqual(['email', 'passwordHash']);
    expect(stored.email).toBe(credentials.email);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toBe(credentials.password);
    expect(await argon2.verify(stored.passwordHash, credentials.password)).toBe(
      true,
    );
    expect(
      await argon2.verify(stored.passwordHash, credentials.password.trim()),
    ).toBe(false);
    expect(result).toEqual(publicUser);
  });

  it('propagates a unique-email violation from save so the HTTP error handler can map it', async () => {
    const duplicateEmail = Object.assign(new Error('duplicate email'), {
      code: '23505',
      constraint: 'uq_users_email',
    });
    repository.save.mockRejectedValue(duplicateEmail);

    await expect(registerService(credentials)).rejects.toBe(duplicateEmail);
  });

  it('propagates other storage failures without returning success', async () => {
    const unavailable = new Error('database unavailable');
    repository.save.mockRejectedValue(unavailable);

    await expect(registerService(credentials)).rejects.toBe(unavailable);
  });

  it('does not create or save a user if hashing fails', async () => {
    const hashingError = new Error('hashing failed');
    vi.mocked(argon2.hash).mockRejectedValueOnce(hashingError);

    await expect(registerService(credentials)).rejects.toBe(hashingError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('loginService', () => {
  it('loads the otherwise hidden password hash, verifies credentials, and returns only public fields', async () => {
    query.getOne.mockResolvedValue(savedUser());

    await expect(loginService(credentials)).resolves.toEqual(publicUser);

    expect(query.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(query.where).toHaveBeenCalledWith('user.email = :email', {
      email: credentials.email,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the generic invalid-credentials error', async () => {
    query.getOne.mockResolvedValue(null);

    await expect(loginService(credentials)).rejects.toMatchObject({
      name: 'HttpError',
      statusCode: 401,
      message: 'Invalid email or password.',
    });
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'incorrect', password: 'A different password' },
    { label: 'trimmed', password: credentials.password.trim() },
    { label: 'lowercased', password: credentials.password.toLowerCase() },
  ])(
    'rejects a $label password with the same generic error',
    async ({ password }) => {
      query.getOne.mockResolvedValue(savedUser());

      await expect(
        loginService({ ...credentials, password }),
      ).rejects.toMatchObject({
        name: 'HttpError',
        statusCode: 401,
        message: 'Invalid email or password.',
      });
    },
  );

  it('propagates database failures without attempting password verification', async () => {
    const unavailable = new Error('database unavailable');
    query.getOne.mockRejectedValue(unavailable);

    await expect(loginService(credentials)).rejects.toBe(unavailable);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it('propagates password verification failures as server errors rather than invalid credentials', async () => {
    const verificationError = new Error('hash verification failed');
    query.getOne.mockResolvedValue(savedUser());
    vi.mocked(argon2.verify).mockRejectedValueOnce(verificationError);

    await expect(loginService(credentials)).rejects.toBe(verificationError);
  });
});

describe('getUserService', () => {
  it('awaits the lookup by exact bigint ID and returns only public fields', async () => {
    repository.findOneBy.mockResolvedValue(savedUser());

    await expect(getUserService(publicUser.userId)).resolves.toEqual(
      publicUser,
    );
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: publicUser.userId,
    });
  });

  it('rejects when the session user no longer exists', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(getUserService(publicUser.userId)).rejects.toEqual(
      new HttpError(404, 'User not found.'),
    );
  });

  it('propagates database lookup failures', async () => {
    const unavailable = new Error('database unavailable');
    repository.findOneBy.mockRejectedValue(unavailable);

    await expect(getUserService(publicUser.userId)).rejects.toBe(unavailable);
  });
});
