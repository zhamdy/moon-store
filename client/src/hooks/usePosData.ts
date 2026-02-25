import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Category, Product, ProductVariant } from '@/types';

interface UsePosDataParams {
  debouncedSearch: string;
  selectedCategory: number | null;
  selectedCollection: number | null;
}

interface UsePosDataReturn {
  favorites: number[] | undefined;
  favMutation: ReturnType<typeof useMutation<unknown, Error, number[]>>;
  toggleFavorite: (productId: number) => void;
  categories: Category[] | undefined;
  collections: { id: number; name: string; product_count: number }[] | undefined;
  products: Product[] | undefined;
  isLoadingProducts: boolean;
  variants: ProductVariant[] | undefined;
  variantProduct: Product | null;
  setVariantProduct: (product: Product | null) => void;
  variantDialogOpen: boolean;
  setVariantDialogOpen: (open: boolean) => void;
}

export function usePosData({
  debouncedSearch,
  selectedCategory,
  selectedCollection,
}: UsePosDataParams): UsePosDataReturn {
  const queryClient = useQueryClient();

  // We manage variant state here because queries depend on it
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);

  // Favorites
  const { data: favorites } = useQuery<number[]>({
    queryKey: ['favorites'],
    queryFn: () => api.get('/api/v1/users/me/favorites').then((r) => r.data.data),
    staleTime: 60 * 1000,
  });

  const favMutation = useMutation({
    mutationFn: (favs: number[]) => api.put('/api/v1/users/me/favorites', { favorites: favs }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const toggleFavorite = (productId: number) => {
    const current = favorites || [];
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    favMutation.mutate(next);
  };

  // Categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  // Collections
  const { data: collections } = useQuery<{ id: number; name: string; product_count: number }[]>({
    queryKey: ['collections-pos'],
    queryFn: () => api.get('/api/v1/collections').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  // Products with debounced search and category/collection filter
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: [
      'products',
      {
        search: debouncedSearch,
        category_id: selectedCategory,
        collection_id: selectedCollection,
        limit: 100,
      },
    ],
    queryFn: () =>
      api
        .get('/api/v1/products', {
          params: {
            search: debouncedSearch || undefined,
            category_id: selectedCategory || undefined,
            collection_id: selectedCollection || undefined,
            limit: 100,
          },
        })
        .then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  // Variants for selected product
  const { data: variants } = useQuery<ProductVariant[]>({
    queryKey: ['product-variants', variantProduct?.id],
    queryFn: () =>
      api.get(`/api/v1/products/${variantProduct!.id}/variants`).then((r) => r.data.data),
    enabled: !!variantProduct && variantDialogOpen,
  });

  return {
    favorites,
    favMutation,
    toggleFavorite,
    categories,
    collections,
    products,
    isLoadingProducts,
    variants,
    variantProduct,
    setVariantProduct,
    variantDialogOpen,
    setVariantDialogOpen,
  };
}
