export type ScrapedProduct = {
  retailer: string;
  sourceProductId?: string;
  productUrl: string;
  title: string;
  brand?: string;
  category?: string;
  price?: number;
  currency?: string;
  imageUrl: string;
  metadata?: Record<string, unknown>;
};
