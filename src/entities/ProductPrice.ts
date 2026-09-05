import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';

import { IngredientProduct } from './IngredientProduct';
import { StoreLocation } from './StoreLocation';

@Entity('product_prices')
@Unique('uq_product_price_observation', [
  'productId',
  'storeLocationId',
  'recordedAt',
])
@Check('chk_product_price_nonnegative', `"price" >= 0`)
@Index('idx_product_prices_product_id', ['productId'])
@Index('idx_product_prices_store_location_id', ['storeLocationId'])
export class ProductPrice {
  @PrimaryGeneratedColumn('identity', {
    name: 'price_id',
    type: 'bigint',
  })
  priceId!: string;

  @Column({
    name: 'product_id',
    type: 'bigint',
  })
  productId!: string;

  @Column({
    name: 'store_location_id',
    type: 'bigint',
  })
  storeLocationId!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  price!: string;

  @Column({
    name: 'currency_code',
    type: 'char',
    length: 3,
    default: 'USD',
  })
  currencyCode!: string;

  @CreateDateColumn({
    name: 'recorded_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  recordedAt!: Date;

  @ManyToOne(() => IngredientProduct, (product) => product.prices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
  })
  product!: IngredientProduct;

  @ManyToOne(() => StoreLocation, (location) => location.prices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'store_location_id',
  })
  storeLocation!: StoreLocation;
}
