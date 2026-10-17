import type {
  CatalogQuery,
  Grant,
  Kind,
  Material,
  MaterialFile,
  Member,
  ViewerFacts,
} from './material.types';

export interface CatalogScope {
  kind?: Kind;
  ownerUserId?: string;
  institutionId?: string;
  management?: boolean;
}
export abstract class MaterialStore {
  abstract find(kind: Kind, id: string): Promise<Material | null>;
  abstract insert(item: Material, actor: string): Promise<void>;
  abstract save(item: Material): Promise<void>;
  abstract facts(item: Material, userId?: string): Promise<ViewerFacts>;
  abstract admin(institutionId: string, userId: string): Promise<boolean>;
  abstract members(collectionId: string): Promise<Member[]>;
  abstract collections(resourceId: string): Promise<Material[]>;
  abstract replaceMembers(
    collectionId: string,
    members: Member[],
  ): Promise<void>;
  abstract file(id: string): Promise<MaterialFile | null>;
  abstract files(item: Material): Promise<MaterialFile[]>;
  abstract saveFile(file: MaterialFile): Promise<void>;
  abstract pendingCount(userId: string): Promise<number>;
  abstract enqueue(file: MaterialFile, after: Date): Promise<void>;
  abstract grant(item: Material, userId: string, grant: Grant): Promise<void>;
  abstract revoke(item: Material, userId: string): Promise<void>;
  abstract catalog(
    query: CatalogQuery,
    scope: CatalogScope,
  ): Promise<{ list: Material[]; total: number }>;
  abstract memberPage(
    collectionId: string,
    query: CatalogQuery,
    management: boolean,
  ): Promise<{ list: { item: Material; position: number }[]; total: number }>;
}
export abstract class MaterialRepository extends MaterialStore {
  /** All feature mutations share a short serializable database transaction. */
  abstract transaction<T>(
    work: (store: MaterialStore) => Promise<T>,
  ): Promise<T>;
}
