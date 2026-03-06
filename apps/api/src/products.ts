export type Product = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string;
};

export const products: Product[] = [
  {
    id: 1,
    title: "Blue Straight Jeans",
    brand: "Sample Denim",
    category: "jeans",
    price: 79.99,
    imagePath: "sample-data/jeans1.jpg",
  },
  {
    id: 2,
    title: "Black Oversized Hoodie",
    brand: "Urban Basic",
    category: "hoodie",
    price: 69.99,
    imagePath: "sample-data/hoodie1.jpg",
  },
  {
    id: 3,
    title: "Light Wash Denim Jacket",
    brand: "Street Layer",
    category: "jacket",
    price: 99.99,
    imagePath: "sample-data/jacket1.jpg",
  },
  {
    id: 4,
    title: "White Casual Sneakers",
    brand: "Daily Move",
    category: "sneakers",
    price: 89.99,
    imagePath: "sample-data/sneakers1.jpg",
  },
  {
    id: 5,
    title: "Grey Pleated Skirt",
    brand: "Soft Form",
    category: "skirt",
    price: 59.99,
    imagePath: "sample-data/skirt1.jpg",
  },
];