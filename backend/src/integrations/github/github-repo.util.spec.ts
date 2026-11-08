import { parseRepository } from './github-repo.util';

describe('parseRepository', () => {
  it('parses owner/name and github URLs', () => {
    expect(parseRepository('vercel/next.js')).toEqual({ owner: 'vercel', name: 'next.js' });
    expect(parseRepository('https://github.com/nestjs/nest.git')).toEqual({ owner: 'nestjs', name: 'nest' });
    expect(parseRepository('https://github.com/nestjs/nest/')).toEqual({ owner: 'nestjs', name: 'nest' });
  });

  it.each(['', 'nestjs', 'a/b/c', '../etc/passwd', 'a/..', 'https://evil.com/a/b', 'a b/c', 'a/b?x=1'])(
    'rejects %p',
    (input) => expect(parseRepository(input)).toBeNull(),
  );
});
