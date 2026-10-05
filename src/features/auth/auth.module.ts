import { Module } from '@nestjs/common';
import { RegisterModule } from './register/register.module';
import { LoginModule } from './login/login.module';
import { PassResetModule } from './pass-reset/pass-reset.module';

@Module({
  imports: [RegisterModule, LoginModule, PassResetModule],
})
export class AuthModule {}
