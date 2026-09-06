import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function lagKlient() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./data/amerikaner.db",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? lagKlient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
