import {Module} from '@nestjs/common';
import {PrismaModule} from '../../core/database/prisma.module';

@Module({
    imports: [PrismaModule],
    providers:[],
    controllers: [],
    exports: [],
})

export class UserProfileModule {}