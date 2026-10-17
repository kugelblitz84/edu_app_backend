import type {
  UploadInputDto,
  UploadUrlResponseDto,
  StorageReferenceDto,
  StorageObject,
  ReadAccessUrlResponseDto,
} from '../presentation/storage_service.dto';

export abstract class StorageProvider {
  abstract createUploadUrl(
    input: UploadInputDto,
  ): Promise<UploadUrlResponseDto>; //frontend request for an upload url
  abstract inspect(reference: StorageReferenceDto): Promise<StorageObject>; //after successfull upload front end hits this so that backend can check and verify
  abstract createReadAccessUrl(
    reference: StorageReferenceDto,
  ): Promise<ReadAccessUrlResponseDto>; //read uploaded files
  abstract delete(reference: StorageReferenceDto): Promise<void>; //delete uploaded files
}
