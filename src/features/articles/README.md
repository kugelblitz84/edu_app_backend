# Article Module Architecture & Implementation

The Article module provides a hybrid document architecture:
- **PostgreSQL (via Prisma)**: Stores relational metadata, author attribution, access policies (`FREE` vs `PURCHASE`), statuses (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `ARCHIVED`), prices, PIN hashes, and persistent unlock grants (`ArticleUnlockGrant`).
- **MongoDB (via Mongoose)**: Stores rich article layout structures, typography themes, and block definitions (`HEADING`, `PARAGRAPH`, `IMAGE`, `QUOTE`, `DIVIDER`).

For the frontend integration guide, DTO contracts, and UI renderer examples, see [Articles_API.md](./Articles_API.md).

---

## 1. Data Stores & Schemas

### PostgreSQL Schema (`prisma/models/article.prisma`)

```prisma
enum ArticleAccessPolicy {
  FREE
  PURCHASE

  @@map("article_access_policy")
}

enum ArticleStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  REJECTED
  ARCHIVED

  @@map("article_status")
}

model Article {
  id               String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title            String               @db.VarChar(200)
  description      String?              @db.Text
  coverImageUrl    String?              @map("cover_image_url") @db.VarChar(2048)
  tags             String[]             @default([])
  accessPolicy     ArticleAccessPolicy  @default(FREE) @map("access_policy")
  status           ArticleStatus        @default(DRAFT)
  priceAmountMinor Int?                 @map("price_amount_minor")
  currency         String?              @default("USD") @db.VarChar(3)
  pinHash          String?              @map("pin_hash")
  contentVersion   Int                  @default(1) @map("content_version")

  authorId         String               @map("author_id") @db.Uuid
  author           User                 @relation("ArticleAuthor", fields: [authorId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  reviewedByUserId String?              @map("reviewed_by_user_id") @db.Uuid
  reviewedByUser   User?                @relation("ArticleReviewer", fields: [reviewedByUserId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  reviewedAt       DateTime?            @map("reviewed_at") @db.Timestamptz
  reviewNotes      String?              @map("review_notes") @db.Text
  rejectReason     String?              @map("reject_reason") @db.Text

  publishedAt      DateTime?            @map("published_at") @db.Timestamptz
  createdAt        DateTime             @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt        DateTime?            @map("deleted_at") @db.Timestamptz

  unlockGrants     ArticleUnlockGrant[]

  @@index([authorId, status, createdAt])
  @@index([status, accessPolicy, publishedAt])
  @@index([status, createdAt])
  @@map("articles")
}

model ArticleUnlockGrant {
  articleId String   @map("article_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  source    String   @default("PIN") @db.VarChar(32)
  grantedAt DateTime @default(now()) @map("granted_at") @db.Timestamptz

  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@id([articleId, userId])
  @@index([userId])
  @@map("article_unlock_grants")
}
```

### MongoDB Schema (`mongoose/models/article.model.ts`)

- **Collection**: `article_contents`
- **Model**: `ArticleContent`
- **Fields**:
  - `articleId`: String (Indexed, unique UUID foreign reference to PostgreSQL `articles.id`)
  - `version`: Number (Auto-incremented whenever content/sections change)
  - `theme`: Theme object (`baseFont`, `headingFont`, `containerWidth`)
  - `sections`: Array of `ArticleSection` (with layout: `SINGLE_COLUMN`, `TWO_COLUMN_EQUAL`, `TWO_COLUMN_WIDE_LEFT`, `MEDIA_TEXT_SPLIT`, plus styles and block collections)
  - `plainTextSummary`: String (Automatically extracted plain text across blocks)

---

## 2. Module Architecture & Injection

```
                  ┌───────────────────────┐
                  │   ArticleController   │
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │    ArticleUseCases    │
                  └─────┬───────────┬─────┘
                        │           │
       ┌────────────────▼──┐     ┌──▼──────────────────────────┐
       │ ArticleRepository │     │  ArticleContentRepository   │
       │ (PostgreSQL/Prisma)     │  (MongoDB/Mongoose)         │
       └───────────────────┘     └─────────────────────────────┘
```

The module is registered in `ArticleModule`:
- `PrismaArticleRepository` is bound to `ArticleRepository`.
- `MongoArticleContentRepository` is bound to `ArticleContentRepository`.
- `PrismaArticleAuthorRepository` is bound to `ArticleAuthorRepository`.

---

## 3. Database Migrations

The additive SQL migration is located at:
`prisma/updates/20261107_article_metadata.sql`

To apply it manually via `psql` or a migration tool:
```bash
psql $DATABASE_URL -f prisma/updates/20261107_article_metadata.sql
```
This creates the tables, enums, unique keys, cascade foreign keys, and search indexes in PostgreSQL.
