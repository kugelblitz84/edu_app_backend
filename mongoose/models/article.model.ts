import mongoose, { type Document, type Model, Schema } from 'mongoose';

// -------------------------------------------------------------
// Typography & Layout Enums / Types
// -------------------------------------------------------------

export type ArticleFontFamily =
  | 'Inter'
  | 'Roboto'
  | 'Merriweather'
  | 'Playfair Display'
  | 'Fira Code'
  | 'System';

export type ArticleTextAlignment = 'left' | 'center' | 'right' | 'justify';

export type SectionLayoutType =
  | 'SINGLE_COLUMN'
  | 'TWO_COLUMN_EQUAL'
  | 'TWO_COLUMN_WIDE_LEFT'
  | 'MEDIA_TEXT_SPLIT';

export type BlockType =
  | 'HEADING'
  | 'PARAGRAPH'
  | 'IMAGE'
  | 'QUOTE'
  | 'DIVIDER';

export type ImagePlacement =
  | 'CONTAINED'
  | 'FULL_BLEED'
  | 'FLOAT_LEFT'
  | 'FLOAT_RIGHT';

export interface SectionStyle {
  fontFamily?: ArticleFontFamily | string;
  backgroundColor?: string;
  textColor?: string;
  paddingY?: 'compact' | 'normal' | 'spacious';
}

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BaseBlock {
  type: 'HEADING';
  level: 1 | 2 | 3 | 4;
  text: string;
  align?: ArticleTextAlignment;
  fontFamily?: ArticleFontFamily | string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'PARAGRAPH';
  html: string;
  align?: ArticleTextAlignment;
  fontSize?: 'sm' | 'base' | 'lg';
  fontFamily?: ArticleFontFamily | string;
}

export interface ImageBlock extends BaseBlock {
  type: 'IMAGE';
  url: string;
  altText?: string;
  caption?: string;
  placement?: ImagePlacement;
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'auto';
  widthPercentage?: number;
}

export interface QuoteBlock extends BaseBlock {
  type: 'QUOTE';
  text: string;
  author?: string;
  style?: 'modern' | 'classic' | 'highlight';
}

export interface DividerBlock extends BaseBlock {
  type: 'DIVIDER';
}

export type ArticleBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | QuoteBlock
  | DividerBlock;

export interface ArticleSection {
  id: string;
  layout: SectionLayoutType;
  style?: SectionStyle;
  blocks?: ArticleBlock[];
  columnLeft?: ArticleBlock[];
  columnRight?: ArticleBlock[];
}

export interface ArticleTheme {
  baseFont: ArticleFontFamily | string;
  headingFont: ArticleFontFamily | string;
  containerWidth: 'normal' | 'wide' | 'narrow';
}

export interface ArticleContentData {
  articleId: string;
  version: number;
  theme: ArticleTheme;
  sections: ArticleSection[];
  plainTextSummary?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ArticleContentDocument = ArticleContentData & Document;

// -------------------------------------------------------------
// Mongoose Schemas
// -------------------------------------------------------------

export const blockSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['HEADING', 'PARAGRAPH', 'IMAGE', 'QUOTE', 'DIVIDER'],
      required: true,
    },
    level: { type: Number, min: 1, max: 4 },
    text: { type: String },
    html: { type: String },
    url: { type: String },
    altText: { type: String },
    caption: { type: String },
    placement: {
      type: String,
      enum: ['CONTAINED', 'FULL_BLEED', 'FLOAT_LEFT', 'FLOAT_RIGHT'],
      default: 'CONTAINED',
    },
    align: {
      type: String,
      enum: ['left', 'center', 'right', 'justify'],
      default: 'left',
    },
    fontFamily: { type: String },
    fontSize: { type: String, enum: ['sm', 'base', 'lg'] },
    aspectRatio: { type: String, enum: ['16:9', '4:3', '1:1', 'auto'] },
    widthPercentage: { type: Number, min: 10, max: 100 },
    author: { type: String },
    style: { type: String },
  },
  { _id: false },
);

export const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    layout: {
      type: String,
      enum: [
        'SINGLE_COLUMN',
        'TWO_COLUMN_EQUAL',
        'TWO_COLUMN_WIDE_LEFT',
        'MEDIA_TEXT_SPLIT',
      ],
      default: 'SINGLE_COLUMN',
    },
    style: {
      fontFamily: { type: String },
      backgroundColor: { type: String },
      textColor: { type: String },
      paddingY: {
        type: String,
        enum: ['compact', 'normal', 'spacious'],
        default: 'normal',
      },
    },
    blocks: { type: [blockSchema], default: [] },
    columnLeft: { type: [blockSchema], default: [] },
    columnRight: { type: [blockSchema], default: [] },
  },
  { _id: false },
);

export const articleContentSchema = new Schema<ArticleContentDocument>(
  {
    articleId: { type: String, required: true, unique: true, index: true },
    version: { type: Number, default: 1 },
    theme: {
      baseFont: { type: String, default: 'Inter' },
      headingFont: { type: String, default: 'Playfair Display' },
      containerWidth: {
        type: String,
        enum: ['normal', 'wide', 'narrow'],
        default: 'normal',
      },
    },
    sections: { type: [sectionSchema], default: [] },
    plainTextSummary: { type: String },
  },
  { timestamps: true },
);

articleContentSchema.index({ articleId: 1 }, { unique: true });

// Export for backward compatibility / model initialization
export const articleSchema = articleContentSchema;
export type ArticleDocument = ArticleContentDocument;
