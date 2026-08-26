import {PassResetEntity, ForgotPassEntity} from '../entities/pass-reset.entity'

// export interface RequestingUser {
//     userId: string;
//     email: string;
// }
export abstract class PassResetRepository {
    abstract resetPass(userId: string, email: string)  : Promise<PassResetEntity>;
    abstract forgotPass(email: string) : Promise
}