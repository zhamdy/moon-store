import { useState, useCallback, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Camera, Package } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import CartPanel from '../components/CartPanel';
import BarcodeScanner from '../components/BarcodeScanner';
import { useCartStore } from '../store/cartStore';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: string | number;
  stock: number;
  min_stock: number;
  category: string;
}

export default function POS() {
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const { addItem } = useCartStore();
  const { t } = useTranslation();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', { search, limit: 100 }],
    queryFn: () =>
      api.get('/api/products', { params: { search, limit: 100 } }).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    try {
      const response = await api.get(`/api/products/barcode/${barcode}`);
      const product = response.data.data as Product;
      if (product) {
        addItem(product);
        setShowScanner(false);
      }
    } catch {
      // Product not found - ignore
    }
  }, [addItem]);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">{t('pos.title')}</h1>
        <div className="gold-divider mt-2" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel - Products */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
              <Input
                placeholder={t('pos.searchPlaceholder')}
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Button
              variant={showScanner ? 'default' : 'outline'}
              onClick={() => setShowScanner(!showScanner)}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {t('pos.scan')}
            </Button>
          </div>

          {showScanner && (
            <div className="rounded-md border border-border overflow-hidden">
              <BarcodeScanner onDetected={handleBarcodeDetected} />
            </div>
          )}

          {/* Product grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-gold/50 hover:shadow-glow transition-all"
                  onClick={() => addItem(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Package className="h-5 w-5 text-gold" />
                      <Badge
                        variant={product.stock <= product.min_stock ? 'warning' : 'secondary'}
                        className="text-[10px]"
                      >
                        {product.stock} {t('pos.inStock')}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-lg font-semibold text-gold font-data mt-1">
                      {formatCurrency(Number(product.price))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel - Cart */}
        <div className="lg:w-96 lg:min-h-[calc(100vh-160px)]">
          <CartPanel />
        </div>
      </div>
    </div>
  );
}
