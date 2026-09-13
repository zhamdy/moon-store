import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';
import type { Category, Product, ProductVariant } from '../../../shared/types/index';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { BUNDLES_PATH, isPostponedPath } from '../../../shared/lib/postponedFeatures';

const products = resource<Product>('products');

interface UsePosDataParams {
  debouncedSearch: string;
  selectedCategory: number | null;
}

export interface PosBundle {
  id: number;
  name: string;
  description: string | null;
  price: number;
  status: string;
  items: {
    product_id: number;
    product_name: string;
    product_price: number;
    quantity: number;
  }[];
  original_price: number;
  savings: number;
  savings_percent: number;
}

interface UsePosDataReturn {
  favorites: number[] | undefined;
  favMutation: ReturnType<typeof useMutation<unknown, Error, number[]>>;
  toggleFavorite: (productId: number) => void;
  categories: Category[] | undefined;
  products: Product[] | undefined;
  favoriteProducts: Product[];
  isLoadingProducts: boolean;
  /** The catalogue read cannot reach the server: it rejected, or it is paused offline (#114). */
  isCatalogueUnreachable: boolean;
  /** Rows are a locally narrowed copy of the last catalogue that loaded (#114). */
  isServingCachedCatalogue: boolean;
  refetchProducts: () => void;
  hasMoreProducts: boolean;
  loadMoreProducts: () => void;
  isLoadingMoreProducts: boolean;
  bundles: PosBundle[] | undefined;
  variants: ProductVariant[] | undefined;
  variantProduct: Product | null;
  setVariantProduct: (product: Product | null) => void;
  variantDialogOpen: boolean;
  setVariantDialogOpen: (open: boolean) => void;
}

export function usePosData({
  debouncedSearch,
  selectedCategory,
}: UsePosDataParams): UsePosDataReturn {
  const queryClient = useQueryClient();
  const transport = useTransport();

  // We manage variant state here because queries depend on it
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);

  // Every read on this screen keeps `staleTime: 0`. A till shows stock, and
  // stock a few minutes old is wrong in the one place being wrong costs money,
  // so these stay on `useApiQuery`, which takes a staleTime, rather than
  // `resource.useList`, which always inherits the app's five-minute default.

  // Favorites
  const { data: favorites } = useApiQuery<number[]>(
    ['favorites'],
    'users/me/favorites',
    undefined,
    { staleTime: 0 }
  );

  // `me` is not a record id, so this write has no `resource` verb to hang off
  // and goes straight to the transport.
  const favMutation = useMutation({
    mutationFn: (favs: number[]) =>
      transport.request({ method: 'PUT', path: 'users/me/favorites', body: { favorites: favs } }),
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
  const { data: categories } = useApiQuery<Category[]>(
    ['categories'],
    'products/categories',
    undefined,
    { staleTime: 0 }
  );

  // Active bundles for POS. Bundles are postponed: no request fires while
  // `/bundles` is hidden, so a disabled feature costs nothing on every till load.
  const { data: allBundles } = useApiQuery<PosBundle[]>(['bundles-pos'], 'bundles', undefined, {
    staleTime: 0,
    enabled: !isPostponedPath(BUNDLES_PATH),
  });
  const bundles = useMemo(
    () => allBundles?.filter((bundle) => bundle.status === 'active'),
    [allBundles]
  );

  // Products with debounced search and category filter
  const {
    products: favoriteProducts,
    searchProducts: productRows,
    isLoading: isLoadingProducts,
    isServingCachedCatalogue,
    isUnreachable: isCatalogueUnreachable,
    refetch: refetchProducts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductCatalog({
    search: debouncedSearch,
    categoryId: selectedCategory,
    selectedIds: favorites,
    staleTime: 0,
  });

  // Variants for selected product
  const { data: variants } = products.useRead<ProductVariant[]>(
    `${variantProduct?.id}/variants`,
    undefined,
    !!variantProduct && variantDialogOpen
  );

  return {
    favorites,
    favMutation,
    toggleFavorite,
    categories,
    products: productRows,
    favoriteProducts,
    isLoadingProducts,
    isCatalogueUnreachable,
    isServingCachedCatalogue,
    refetchProducts: () => void refetchProducts(),
    hasMoreProducts: !!hasNextPage,
    loadMoreProducts: () => void fetchNextPage(),
    isLoadingMoreProducts: isFetchingNextPage,
    bundles,
    variants,
    variantProduct,
    setVariantProduct,
    variantDialogOpen,
    setVariantDialogOpen,
  };
}
