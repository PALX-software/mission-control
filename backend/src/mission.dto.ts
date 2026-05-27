import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  domain!: string;
}

export class DelegateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  initiative!: string;
}
