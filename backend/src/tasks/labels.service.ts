import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/tasks.dto';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.label.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
  }

  async create(workspaceId: string, dto: CreateLabelDto) {
    try {
      return await this.prisma.label.create({
        data: { workspaceId, name: dto.name.trim(), color: dto.color.toLowerCase() },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('Label already exists');
      throw err;
    }
  }

  async remove(workspaceId: string, labelId: string) {
    const result = await this.prisma.label.deleteMany({ where: { id: labelId, workspaceId } });
    if (result.count === 0) throw new NotFoundException('Label not found');
  }
}
