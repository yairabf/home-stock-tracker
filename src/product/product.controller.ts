import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AddProductAliasDto } from './dto/add-product-alias.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductSearchResponseDto } from './dto/product-search-response.dto';
import { SearchProductsQueryDto } from './dto/search-products-query.dto';
import { ProductSearchService } from './product-search.service';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productSearchService: ProductSearchService,
  ) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productService.create(dto);
    return ProductResponseDto.fromEntity(product);
  }

  @Get()
  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productService.findAll();
    return products.map((product) => ProductResponseDto.fromEntity(product));
  }

  @Get('search')
  async search(
    @Query() query: SearchProductsQueryDto,
  ): Promise<ProductSearchResponseDto> {
    const result = await this.productSearchService.search(query);
    return ProductSearchResponseDto.fromContract(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.productService.findOne(id);
    return ProductResponseDto.fromEntity(product);
  }

  @Post(':id/aliases')
  async addAlias(
    @Param('id') id: string,
    @Body() dto: AddProductAliasDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.addAlias(id, dto);
    return ProductResponseDto.fromEntity(product);
  }
}
