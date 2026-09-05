import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

import { StoreLocation } from './StoreLocation';

@Entity('retailers')
@Unique('uq_retailers_name', ['name'])
export class Retailer {
  @PrimaryGeneratedColumn('identity', {
    name: 'retailer_id',
    type: 'bigint',
  })
  retailerId!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @Column({
    name: 'website_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  websiteUrl!: string | null;

  @OneToMany(() => StoreLocation, (location) => location.retailer)
  locations!: StoreLocation[];

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
