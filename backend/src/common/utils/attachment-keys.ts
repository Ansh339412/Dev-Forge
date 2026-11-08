import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Collect storage keys before a cascading delete removes the attachment rows. */
export async function attachmentKeys(
  prisma: PrismaService,
  where: Prisma.AttachmentWhereInput,
): Promise<string[]> {
  const rows = await prisma.attachment.findMany({ where, select: { storageKey: true } });
  return rows.map((r) => r.storageKey);
}
