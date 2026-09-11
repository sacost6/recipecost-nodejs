import * as argon2 from 'argon2';
import { userRepository } from '../repositories/users.repo';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { HttpError } from '../middleware/errorHandling/utils';

export const registerService = async (input: RegisterInput) => {
  const user = userRepository.create({
    email: input.email,
    passwordHash: await argon2.hash(input.password),
  });

  const savedUser = await userRepository.save(user);

  return {
    userId: savedUser.userId,
    email: savedUser.email,
  };
};

export const loginService = async (input: LoginInput) => {
  const user = await userRepository
    .createQueryBuilder('user')
    .addSelect('user.passwordHash')
    .where('user.email = :email', { email: input.email })
    .getOne();

  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const passwordMatches = await argon2.verify(
    user.passwordHash,
    input.password,
  );

  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  return {
    userId: user.userId,
    email: user.email,
  };
};
