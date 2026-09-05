import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

import { Retailer } from './Retailer';
import { ProductPrice } from './ProductPrice';

@Entity('store_locations')
@Unique('uq_store_location_number', ['retailerId', 'storeNumber'])
@Index('idx_store_locations_retailer_id', ['retailerId'])
@Index('idx_store_locations_postal_code', ['postalCode'])
export class StoreLocation {
  @PrimaryGeneratedColumn('identity', {
    name: 'store_location_id',
    type: 'bigint',
  })
  storeLocationId!: string;

  @Column({
    name: 'retailer_id',
    type: 'bigint',
  })
  retailerId!: string;

  @Column({
    name: 'store_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  storeNumber!: string | null;

  @Column({
    name: 'address_line1',
    type: 'varchar',
    length: 150,
  })
  addressLine1!: string;

  @Column({
    name: 'address_line2',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  addressLine2!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  city!: string;

  @Column({
    name: 'state_code',
    type: 'varchar',
    length: 10,
  })
  stateCode!: string;

  @Column({
    name: 'postal_code',
    type: 'varchar',
    length: 20,
  })
  postalCode!: string;

  @Column({
    name: 'country_code',
    type: 'char',
    length: 2,
    default: 'US',
  })
  countryCode!: string;

  @ManyToOne(() => Retailer, (retailer) => retailer.locations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'retailer_id',
  })
  retailer!: Retailer;

  @OneToMany(() => ProductPrice, (price) => price.storeLocation)
  prices!: ProductPrice[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
