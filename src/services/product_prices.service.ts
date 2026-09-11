import { productPriceRepository } from '../repositories/product_prices.schema';
import { ingredientProductRepository } from '../repositories/ingredient_products.repo';
import { ProductPrice } from '../entities/ProductPrice';
import {
  CreateProductPriceInput,
  UpdateProductPriceInput,
} from '../schemas/product_prices.schema';
import { HttpError } from '../middleware/errorHandling/ error';
import { getIngredientProductByIdService } from './ingredient_products.service';

export const getProductPricesService = async (
  userId: string,
): Promise<ProductPrice[]> => {
  return productPriceRepository.find({
    where: { product: { userId } },
    order: { recordedAt: 'DESC', priceId: 'DESC' },
  });
};

export const getProductPriceByIdService = async (
  userId: string,
  priceId: string,
): Promise<ProductPrice> => {
  const productPrice = await productPriceRepository.findOneBy({
    priceId,
    product: { userId },
  });

  if (!productPrice) {
    throw new HttpError(404, 'Price not found.');
  }

  return productPrice;
};

export const getProductPricesByProductIdService = async (
  userId: string,
  productId: string,
): Promise<ProductPrice[]> => {
  await getIngredientProductByIdService(userId, productId);

  return productPriceRepository.find({
    where: { productId, product: { userId } },
    order: { recordedAt: 'DESC', priceId: 'DESC' },
  });
};

export const createProductPriceService = async (
  userId: string,
  input: CreateProductPriceInput,
): Promise<ProductPrice> => {
  await getIngredientProductByIdService(userId, input.productId);

  const productPrice = productPriceRepository.create({
    productId: input.productId,
    storeLocationId: input.storeLocationId,
    price: input.price,
    currencyCode: input.currencyCode,
  });

  return productPriceRepository.save(productPrice);
};

// Keep the ownership check in each write's SQL predicate as well as in reads.
const ownedProductIdsQuery = () =>
  ingredientProductRepository
    .createQueryBuilder('ownedProduct')
    .select('ownedProduct.productId')
    .where('ownedProduct.userId = :userId')
    .getQuery();

export const updateProductPriceService = async (
  userId: string,
  priceId: string,
  input: UpdateProductPriceInput,
): Promise<ProductPrice> => {
  const result = await productPriceRepository
    .createQueryBuilder()
    .update()
    .set({
      storeLocationId: input.storeLocationId,
      price: input.price,
      currencyCode: input.currencyCode,
    })
    .where('"price_id" = :priceId', { priceId })
    .andWhere(`"product_id" IN (${ownedProductIdsQuery()})`, { userId })
    .execute();

  if (result.affected === 0) {
    throw new HttpError(404, 'Price not found.');
  }

  return getProductPriceByIdService(userId, priceId);
};

export const deleteProductPriceService = async (
  userId: string,
  priceId: string,
): Promise<void> => {
  const result = await productPriceRepository
    .createQueryBuilder()
    .delete()
    .where('"price_id" = :priceId', { priceId })
    .andWhere(`"product_id" IN (${ownedProductIdsQuery()})`, { userId })
    .execute();

  if (result.affected === 0) {
    throw new HttpError(404, 'Price not found.');
  }
};
