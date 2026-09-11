import { productPriceRepository } from '../repositories/product_prices.schema';
import { ProductPrice } from '../entities/ProductPrice';
import {
  CreateProductPriceInput,
  UpdateProductPriceInput,
} from '../schemas/product_prices.schema';
import { HttpError } from '../middleware/errorHandling/utils';
export const getProductPricesService = async (): Promise<ProductPrice[]> => {
  return productPriceRepository.find({
    order: { productId: 'ASC' },
  });
};

export const getProductPriceByProductIdService = async (
  productId: string,
): Promise<ProductPrice> => {
  const productPrice = await productPriceRepository.findOneBy({
    productId,
  });

  if (!productPrice) {
    throw new HttpError(404, 'There is no price for this product.');
  }

  return productPrice;
};

export const createProductPriceService = async (
  input: CreateProductPriceInput,
): Promise<ProductPrice> => {
  const productPrice = productPriceRepository.create({
    productId: input.productId,
    storeLocationId: input.storeLocationId,
    price: input.price,
    currencyCode: input.currencyCode,
  });

  return productPriceRepository.save(productPrice);
};

export const updateProductPriceService = async (
  productId: string,
  input: UpdateProductPriceInput,
): Promise<ProductPrice> => {
  const productPrice = await getProductPriceByProductIdService(productId);

  productPriceRepository.merge(productPrice, input);

  return productPriceRepository.save(productPrice);
};

export const deleteProductPriceService = async (
  productId: string,
): Promise<void> => {
  const result = await productPriceRepository.delete({ productId });

  if (result.affected === 0) {
    throw new HttpError(404, 'There is no price for this product');
  }
};
