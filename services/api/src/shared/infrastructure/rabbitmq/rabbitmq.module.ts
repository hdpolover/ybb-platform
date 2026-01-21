import { Module, Global } from '@nestjs/common';
import { RabbitMQProducerService } from './rabbitmq-producer.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RabbitMQProducerService],
  exports: [RabbitMQProducerService],
})
export class RabbitMQModule {}
