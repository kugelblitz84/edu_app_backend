# Articles API — Frontend & Integration Guide

The Article module provides a hybrid document architecture:
- **PostgreSQL (via Prisma)**: Manages relational metadata, author attribution, lifecycle statuses (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `ARCHIVED`), monetization access policies (`FREE`, `PURCHASE`), pricing, and transactional unlock grants.
- **MongoDB (via Mongoose)**: Manages rich, flexible, block-based article layout typography, container themes, sections, and diverse block types (`HEADING`, `PARAGRAPH`, `IMAGE`, `QUOTE`, `DIVIDER`).

Base URL: `/api/v1/articles`  
Admin Review URL: `/api/v1/global-admin/articles`

Send `Authorization: Bearer <accessToken>` for authenticated routes. Routes marked as **Optional Auth** work anonymously for public readers, but automatically use the authenticated user's session when present to compute personalized reading authorization.

---

## 1. Domain Types & Data Contracts

### Typography & Theme Types

```ts
export type ArticleFontFamily =
  | 'Inter'
  | 'Roboto'
  | 'Merriweather'
  | 'Playfair Display'
  | 'Fira Code'
  | 'System'
  | string;

export type ArticleTextAlignment = 'left' | 'center' | 'right' | 'justify';

export type SectionLayoutType =
  | 'SINGLE_COLUMN'
  | 'TWO_COLUMN_EQUAL'
  | 'TWO_COLUMN_WIDE_LEFT'
  | 'MEDIA_TEXT_SPLIT';

export interface ArticleTheme {
  baseFont: ArticleFontFamily;
  headingFont: ArticleFontFamily;
  containerWidth: 'normal' | 'wide' | 'narrow';
}
```

### Discriminated Union Blocks

```ts
export interface HeadingBlock {
  id: string;
  type: 'HEADING';
  level: 1 | 2 | 3 | 4;
  text: string;
  align?: ArticleTextAlignment;
  fontFamily?: ArticleFontFamily;
}

export interface ParagraphBlock {
  id: string;
  type: 'PARAGRAPH';
  html: string;
  align?: ArticleTextAlignment;
  fontSize?: 'sm' | 'base' | 'lg';
  fontFamily?: ArticleFontFamily;
}

export interface ImageBlock {
  id: string;
  type: 'IMAGE';
  url: string;
  altText?: string;
  caption?: string;
  placement?: 'CONTAINED' | 'FULL_BLEED' | 'FLOAT_LEFT' | 'FLOAT_RIGHT';
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'auto';
  widthPercentage?: number; // 10 to 100
}

export interface QuoteBlock {
  id: string;
  type: 'QUOTE';
  text: string;
  author?: string;
  style?: 'modern' | 'classic' | 'highlight';
}

export interface DividerBlock {
  id: string;
  type: 'DIVIDER';
}

export type ArticleBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | QuoteBlock
  | DividerBlock;
```

### Layout Sections & Content Payload

```ts
export interface ArticleSection {
  id: string;
  layout: SectionLayoutType;
  style?: {
    fontFamily?: ArticleFontFamily;
    backgroundColor?: string;
    textColor?: string;
    paddingY?: 'compact' | 'normal' | 'spacious';
  };
  blocks?: ArticleBlock[];        // Used when layout is SINGLE_COLUMN
  columnLeft?: ArticleBlock[];    // Used when layout is two-column
  columnRight?: ArticleBlock[];   // Used when layout is two-column
}

export interface ArticleContentPayload {
  articleId: string;
  version: number;
  theme: ArticleTheme;
  sections: ArticleSection[];
  plainTextSummary?: string;
}
```

### Summary & Detail Views

```ts
export type ArticleAccessPolicy = 'FREE' | 'PURCHASE';
export type ArticleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface ArticleSummaryView {
  id: string;
  contentId: string; // Alias matching id
  title: string;
  description?: string;
  accessPolicy: ArticleAccessPolicy;
  priceAmountMinor?: number;
  currency?: string;
  status: ArticleStatus;
  tags: string[];
  coverImageUrl?: string;
  authorUsername: string;
  authorFullName?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface ArticleDetailView extends ArticleSummaryView {
  content?: string;                          // Plaintext / summary fallback
  contentPayload?: ArticleContentPayload;    // Present ONLY when canAccess is true
  previewSnippet?: string;                   // Present when canAccess is false
  access: {
    canAccess: boolean;
    reason?: 'FREE' | 'PIN_REQUIRED' | 'OWNER' | 'UNLOCKED' | 'UNAVAILABLE' | 'SUPER_ADMIN';
    source?: 'OWNER' | 'UNLOCKED';
  };
  rejectReason?: string;
  reviewNotes?: string;
}
```

---

## 2. API Endpoints & DTO Examples

### 2.1 Create Article Draft
- **Endpoint**: `POST /api/v1/articles`
- **Auth**: Required (`Bearer <token>`)
- **Status Code**: `201 Created`

#### Request Body (`CreateArticleDto`)
Authors can supply either structured `sections` (recommended) or a simple fallback `content` string (which the server automatically converts into a section block):

```json
{
  "title": "Mastering Microservices Architecture in 2026",
  "description": "A comprehensive deep dive into distributed systems, event-driven architecture, and sagas.",
  "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
  "tags": ["backend", "microservices", "system-design"],
  "accessPolicy": "PURCHASE",
  "priceAmountMinor": 499,
  "currency": "USD",
  "pin": "securePass2026",
  "theme": {
    "baseFont": "Inter",
    "headingFont": "Playfair Display",
    "containerWidth": "normal"
  },
  "sections": [
    {
      "id": "sec-intro",
      "layout": "SINGLE_COLUMN",
      "style": {
        "paddingY": "normal"
      },
      "blocks": [
        {
          "id": "blk-h1",
          "type": "HEADING",
          "level": 1,
          "text": "The Shift from Monolith to Event-Driven Architecture",
          "align": "left"
        },
        {
          "id": "blk-p1",
          "type": "PARAGRAPH",
          "html": "<p>Modern software systems demand high scalability and fault isolation. In this guide, we examine patterns that ensure high availability while managing state across decoupled services.</p>",
          "fontSize": "base"
        },
        {
          "id": "blk-quote1",
          "type": "QUOTE",
          "text": "Simplicity is prerequisite for reliability.",
          "author": "Edsger W. Dijkstra",
          "style": "highlight"
        }
      ]
    },
    {
      "id": "sec-split",
      "layout": "MEDIA_TEXT_SPLIT",
      "columnLeft": [
        {
          "id": "blk-img1",
          "type": "IMAGE",
          "url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
          "altText": "Server clusters",
          "caption": "Figure 1: Distributed multi-region nodes",
          "placement": "CONTAINED",
          "aspectRatio": "16:9"
        }
      ],
      "columnRight": [
        {
          "id": "blk-p2",
          "type": "PARAGRAPH",
          "html": "<p>When partitioning services across clusters, network latency and partition tolerance become foundational constraints.</p>",
          "fontSize": "base"
        }
      ]
    }
  ]
}
```

#### Response (`201 Created`)
```json
{
  "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "title": "Mastering Microservices Architecture in 2026",
  "description": "A comprehensive deep dive into distributed systems, event-driven architecture, and sagas.",
  "accessPolicy": "PURCHASE",
  "priceAmountMinor": 499,
  "currency": "USD",
  "status": "DRAFT",
  "tags": ["backend", "microservices", "system-design"],
  "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
  "authorUsername": "sadimahmud",
  "authorFullName": "Sadi Mahmud",
  "createdAt": "2026-11-07T12:00:00.000Z",
  "publishedAt": null
}
```

---

### 2.2 Update Article Draft
- **Endpoint**: `PATCH /api/v1/articles/:id`
- **Auth**: Required (`Bearer <token>`)
- **Rules**:
  - Caller must be the original author.
  - Article status must be `DRAFT` or `REJECTED`.
  - Updating content or sections increments the article `contentVersion` automatically.

#### Request Body (`UpdateArticleDto`)
All fields are optional. Only supply fields that are changing:
```json
{
  "title": "Mastering Microservices & Distributed Systems in 2026",
  "priceAmountMinor": 599,
  "theme": {
    "baseFont": "Inter",
    "headingFont": "Playfair Display",
    "containerWidth": "wide"
  }
}
```

#### Response (`200 OK`)
Returns the updated `ArticleSummaryView`.

---

### 2.3 Submit for Review
- **Endpoint**: `POST /api/v1/articles/:id/submit-for-review`
- **Auth**: Required (`Bearer <token>`)
- **Rules**:
  - Caller must be the author.
  - Article status must be `DRAFT` or `REJECTED`.
  - Article content in MongoDB must contain at least 10 characters across blocks.

#### Response (`200 OK`)
```json
{
  "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "title": "Mastering Microservices & Distributed Systems in 2026",
  "description": "A comprehensive deep dive into distributed systems, event-driven architecture, and sagas.",
  "accessPolicy": "PURCHASE",
  "priceAmountMinor": 599,
  "currency": "USD",
  "status": "PENDING_REVIEW",
  "tags": ["backend", "microservices", "system-design"],
  "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
  "authorUsername": "sadimahmud",
  "authorFullName": "Sadi Mahmud",
  "createdAt": "2026-11-07T12:00:00.000Z",
  "publishedAt": null
}
```

---

### 2.4 List Published Articles (Public Feed)
- **Endpoint**: `GET /api/v1/articles`
- **Auth**: Optional
- **Query Parameters**:
  - `page`: integer (default: 1)
  - `limit`: integer (default: 20, max: 100)
  - `search`: string (case-insensitive substring filter against title and description)
  - `tag`: string (filter by exact tag)
  - `policy`: `'FREE'` | `'PURCHASE'`

#### Response (`200 OK`)
```json
{
  "list": [
    {
      "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
      "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
      "title": "Mastering Microservices & Distributed Systems in 2026",
      "description": "A comprehensive deep dive into distributed systems, event-driven architecture, and sagas.",
      "accessPolicy": "PURCHASE",
      "priceAmountMinor": 599,
      "currency": "USD",
      "status": "PUBLISHED",
      "tags": ["backend", "microservices"],
      "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
      "authorUsername": "sadimahmud",
      "authorFullName": "Sadi Mahmud",
      "createdAt": "2026-11-07T12:00:00.000Z",
      "publishedAt": "2026-11-07T13:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

---

### 2.5 Get Article Detail & Reading View
- **Endpoint**: `GET /api/v1/articles/:id`
- **Auth**: Optional (caller credentials identify the author or check if the user previously unlocked the article)

#### Scenario A: Unlocked / Free Article / Author View
When the user is authorized to read the article, the response includes `contentPayload`:

```json
{
  "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "title": "Mastering Microservices Architecture in 2026",
  "description": "A comprehensive deep dive into distributed systems.",
  "accessPolicy": "FREE",
  "status": "PUBLISHED",
  "tags": ["backend", "microservices"],
  "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
  "authorUsername": "sadimahmud",
  "authorFullName": "Sadi Mahmud",
  "createdAt": "2026-11-07T12:00:00.000Z",
  "publishedAt": "2026-11-07T13:00:00.000Z",
  "content": "The Shift from Monolith to Event-Driven Architecture...",
  "contentPayload": {
    "articleId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
    "version": 1,
    "theme": {
      "baseFont": "Inter",
      "headingFont": "Playfair Display",
      "containerWidth": "normal"
    },
    "sections": [
      {
        "id": "sec-intro",
        "layout": "SINGLE_COLUMN",
        "blocks": [
          {
            "id": "blk-h1",
            "type": "HEADING",
            "level": 1,
            "text": "The Shift from Monolith to Event-Driven Architecture"
          },
          {
            "id": "blk-p1",
            "type": "PARAGRAPH",
            "html": "<p>Modern software systems demand high scalability and fault isolation...</p>"
          }
        ]
      }
    ],
    "plainTextSummary": "The Shift from Monolith to Event-Driven Architecture..."
  },
  "access": {
    "canAccess": true,
    "reason": "FREE"
  }
}
```

#### Scenario B: Locked Paid Article
When a reader hasn't unlocked the paid article, the response protects the content: `contentPayload` and `content` are `undefined`, and only `previewSnippet` is returned:

```json
{
  "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
  "title": "Mastering Microservices Architecture in 2026",
  "description": "A comprehensive deep dive into distributed systems.",
  "accessPolicy": "PURCHASE",
  "priceAmountMinor": 599,
  "currency": "USD",
  "status": "PUBLISHED",
  "tags": ["backend", "microservices"],
  "coverImageUrl": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
  "authorUsername": "sadimahmud",
  "authorFullName": "Sadi Mahmud",
  "createdAt": "2026-11-07T12:00:00.000Z",
  "publishedAt": "2026-11-07T13:00:00.000Z",
  "previewSnippet": "A comprehensive deep dive into distributed systems.",
  "access": {
    "canAccess": false,
    "reason": "PIN_REQUIRED"
  }
}
```

---

### 2.6 Unlock Paid Article with PIN
- **Endpoint**: `POST /api/v1/articles/:id/unlock`
- **Auth**: Required (`Bearer <token>`)

#### Request Body (`UnlockArticleDto`)
```json
{
  "pin": "securePass2026"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Article unlocked successfully."
}
```
*After this call succeeds, refreshing or re-fetching `GET /api/v1/articles/:id` returns `access.canAccess: true` with the full `contentPayload` permanently linked to the user's account.*

---

### 2.7 Author's Articles Dashboard
- **Endpoint**: `GET /api/v1/articles/me?page=1&limit=20`
- **Auth**: Required (`Bearer <token>`)

#### Response (`200 OK`)
```json
{
  "list": [
    {
      "id": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
      "contentId": "6c459b71-12c8-47bc-ba7b-f9e42999710f",
      "title": "Mastering Microservices Architecture in 2026",
      "status": "REJECTED",
      "rejectReason": "Please provide citations for the benchmark statistics in section 2.",
      "reviewNotes": "Draft layout looks good, just needs benchmark references.",
      "accessPolicy": "PURCHASE",
      "tags": ["backend"],
      "createdAt": "2026-11-07T12:00:00.000Z",
      "publishedAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### 2.8 Global Admin Review Endpoints

#### List Pending Articles
- **Endpoint**: `GET /api/v1/global-admin/articles/pending?page=1&limit=20`
- **Role**: `GLOBAL_ADMIN`

#### Inspect Article for Review (Includes full layout payload)
- **Endpoint**: `GET /api/v1/global-admin/articles/:id`
- **Role**: `GLOBAL_ADMIN`
- Returns `ArticleDetailView` with `access: { canAccess: true, reason: 'SUPER_ADMIN' }` and full `contentPayload`.

#### Adjudicate (Approve or Reject)
- **Endpoint**: `PATCH /api/v1/global-admin/articles/:id/respond`
- **Role**: `GLOBAL_ADMIN`

##### Approval Example
```json
{
  "status": "APPROVED",
  "reviewNotes": "Thoroughly researched and well structured."
}
```

##### Rejection Example
```json
{
  "status": "REJECTED",
  "rejectReason": "Please provide citations for the benchmark statistics in section 2.",
  "reviewNotes": "Draft layout looks good, just needs benchmark references."
}
```

---

## 3. Frontend Architecture & Implementation Guide

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND INTEGRATION MAP                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Public Feed (`ArticleFeedPage`)                                     │
│    ├── Filter by Policy (Free vs Paid), Search, and Tags               │
│    └── Card displays cover, metadata, author, and price badge          │
│                                                                        │
│ 2. Reader (`ArticleReaderPage`)                                        │
│    ├── Evaluates `access.canAccess`                                    │
│    ├── IF `false`: Render preview snippet + <ArticlePinUnlockModal />  │
│    └── IF `true`: Render <ArticleContentRenderer payload={...} />      │
│         ├── Theme Provider (fonts, container max-width)                │
│         └── Section & Block Dispatcher                                 │
│                                                                        │
│ 3. Author Studio (`ArticleStudioPage`)                                 │
│    ├── Metadata Form (Title, Cover, Tags, Access Policy, PIN, Price)  │
│    ├── Block Editor (Add/Rearrange sections, single/multi-column)      │
│    └── Status Controls: Save Draft (PATCH) / Submit for Review (POST)  │
│                                                                        │
│ 4. Admin Review Queue (`AdminArticleReviewPortal`)                     │
│    ├── Pending Submissions Table                                       │
│    └── Side-by-side Layout Viewer + Approval / Rejection form          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 Implementing the Article Content Renderer (React Example)

The frontend should map the MongoDB `contentPayload` to a typography theme wrapper and layout section components:

```tsx
import React from 'react';
import type {
  ArticleContentPayload,
  ArticleSection,
  ArticleBlock,
} from './article.types';

// 1. Block Dispatcher Component
export const ArticleBlockRenderer: React.FC<{ block: ArticleBlock }> = ({ block }) => {
  switch (block.type) {
    case 'HEADING': {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag
          className={`font-heading my-4 text-${block.align || 'left'}`}
          style={{ fontFamily: block.fontFamily }}
        >
          {block.text}
        </Tag>
      );
    }
    case 'PARAGRAPH': {
      const sizeClasses = {
        sm: 'text-sm leading-relaxed',
        base: 'text-base leading-relaxed',
        lg: 'text-lg leading-loose',
      }[block.fontSize || 'base'];

      return (
        <div
          className={`my-3 text-${block.align || 'left'} ${sizeClasses}`}
          style={{ fontFamily: block.fontFamily }}
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    }
    case 'IMAGE': {
      return (
        <figure className={`my-6 ${block.placement === 'FULL_BLEED' ? '-mx-8' : ''}`}>
          <img
            src={block.url}
            alt={block.altText || ''}
            className="w-full rounded-lg object-cover shadow-sm"
            style={{ width: block.widthPercentage ? `${block.widthPercentage}%` : '100%' }}
            loading="lazy"
          />
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-gray-500 italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case 'QUOTE': {
      return (
        <blockquote className="my-6 border-l-4 border-primary pl-4 italic text-gray-700">
          <p className="text-lg">"{block.text}"</p>
          {block.author && (
            <footer className="mt-1 text-sm font-semibold text-gray-500">
              — {block.author}
            </footer>
          )}
        </blockquote>
      );
    }
    case 'DIVIDER': {
      return <hr className="my-8 border-gray-200" />;
    }
    default:
      return null;
  }
};

// 2. Section Layout Component
export const ArticleSectionRenderer: React.FC<{ section: ArticleSection }> = ({ section }) => {
  const paddingClass = {
    compact: 'py-2',
    normal: 'py-6',
    spacious: 'py-12',
  }[section.style?.paddingY || 'normal'];

  if (section.layout === 'SINGLE_COLUMN') {
    return (
      <section
        className={`section-single ${paddingClass}`}
        style={{
          backgroundColor: section.style?.backgroundColor,
          color: section.style?.textColor,
        }}
      >
        {section.blocks?.map((block) => (
          <ArticleBlockRenderer key={block.id} block={block} />
        ))}
      </section>
    );
  }

  const gridClasses = {
    TWO_COLUMN_EQUAL: 'grid grid-cols-1 md:grid-cols-2 gap-8',
    TWO_COLUMN_WIDE_LEFT: 'grid grid-cols-1 md:grid-cols-3 gap-8 [&>*:first-child]:md:col-span-2',
    MEDIA_TEXT_SPLIT: 'grid grid-cols-1 md:grid-cols-2 items-center gap-8',
  }[section.layout];

  return (
    <section
      className={`${gridClasses} ${paddingClass}`}
      style={{
        backgroundColor: section.style?.backgroundColor,
        color: section.style?.textColor,
      }}
    >
      <div className="col-left">
        {section.columnLeft?.map((block) => (
          <ArticleBlockRenderer key={block.id} block={block} />
        ))}
      </div>
      <div className="col-right">
        {section.columnRight?.map((block) => (
          <ArticleBlockRenderer key={block.id} block={block} />
        ))}
      </div>
    </section>
  );
};

// 3. Full Article Document Renderer with Theme Wrapper
export const ArticleDocumentView: React.FC<{ payload: ArticleContentPayload }> = ({ payload }) => {
  const maxWidthClass = {
    narrow: 'max-w-2xl',
    normal: 'max-w-4xl',
    wide: 'max-w-6xl',
  }[payload.theme?.containerWidth || 'normal'];

  return (
    <article
      className={`mx-auto px-4 ${maxWidthClass}`}
      style={
        {
          '--font-base': payload.theme?.baseFont || 'Inter, sans-serif',
          '--font-heading': payload.theme?.headingFont || 'Playfair Display, serif',
          fontFamily: 'var(--font-base)',
        } as React.CSSProperties
      }
    >
      {payload.sections.map((section) => (
        <ArticleSectionRenderer key={section.id} section={section} />
      ))}
    </article>
  );
};
```

---

### 3.2 Handling the PIN Unlock Flow

```
┌────────────────────────────────────────────────────────┐
│ USER OPENS ARTICLE PAGE                                │
│ GET /api/v1/articles/:id (with Bearer Token if logged) │
└──────────────────────────┬─────────────────────────────┘
                           ▼
            Does `access.canAccess === true`?
                    /            \
                  YES             NO
                  /                \
   Render Full Article View         Show Hero & `previewSnippet`
   <ArticleDocumentView />          Display "Unlock with PIN" button
                                    Clicking button opens <PinModal />
                                           │
                                           ▼
                                    POST /api/v1/articles/:id/unlock
                                    Body: { "pin": enteredPin }
                                           │
                                    ┌──────┴──────┐
                                200 OK          403 Forbidden
                                   │                  │
                          Trigger query reload   Show "Invalid PIN"
                          GET /api/v1/articles/:id
                          `canAccess` is now TRUE!
```

#### Unlock Modal Handler (TypeScript)

```ts
async function handlePinSubmit(articleId: string, pin: string) {
  try {
    const res = await fetch(`/api/v1/articles/${articleId}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Invalid PIN code. Please double-check and retry.');
      }
      throw new Error('Failed to unlock article.');
    }

    // Refresh article detail query. The server now returns canAccess: true and contentPayload.
    await refetchArticleDetail(articleId);
  } catch (err: any) {
    displayToast(err.message, 'error');
  }
}
```

---

### 3.3 Author Studio State Management & Auto-saving

1. **Auto-Save Draft**: Debounce input edits by 2 seconds and send `PATCH /api/v1/articles/:id` with updated `theme` and `sections`.
2. **Pre-submission Verification**:
   - Ensure the total text across blocks is $\ge 10$ characters.
   - For `PURCHASE` articles, ensure `priceAmountMinor` $> 0$ and `pin` is set.
3. **Submit Button**:
   - Dispatches `POST /api/v1/articles/:id/submit-for-review`.
   - Transitions local state to `PENDING_REVIEW`, making the editor read-only until the article is adjudicated.
4. **Handling Rejections**:
   - If an article has `status: 'REJECTED'`, display a banner containing `rejectReason`.
   - Author can edit the blocks and re-trigger `POST /api/v1/articles/:id/submit-for-review`.
