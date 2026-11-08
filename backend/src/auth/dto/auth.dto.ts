import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const PASSWORD_MIN = 10;

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}

export class EmailDto {
  @IsEmail()
  email: string;
}

export class TokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  refreshToken: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  newPassword: string;
}
