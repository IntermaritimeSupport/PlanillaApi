// src/utils/companyCodeGenerator.ts

import { PrismaClient } from "../../generated/prisma/client";

/**
 * Generates the next sequential company code (e.g., CO001, CO002).
 * It searches for the highest numeric code among existing companies that start with 'CO'
 * and increments it.
 * @param prisma PrismaClient instance.
 * @returns The next available company code.
 */
export async function generateNextCompanyCode(prisma: PrismaClient): Promise<string> {
  // Find all companies with codes starting with 'CO'
  const companies = await prisma.company.findMany({
    where: {
      code: {
        startsWith: 'CO',
      },
    },
    select: {
      code: true,
    },
    orderBy: {
      code: 'desc', // Order by code descending to easily find the highest
    },
    take: 1, // Only need the top one
  });

  let maxCodeNum = 0;
  if (companies.length > 0 && companies[0].code) {
    // Extract the numeric part of the code (e.g., from 'CO001' get '1')
    const numericPart = parseInt(companies[0].code.replace('CO', ''), 10);
    // If it's a valid number and greater than the current maximum, update maxCodeNum
    if (!isNaN(numericPart)) {
      maxCodeNum = numericPart;
    }
  }

  // The next code number is the found maximum + 1
  const nextCodeNum = maxCodeNum + 1;
  // Format the number with leading zeros (e.g., 1 -> '001', 12 -> '012')
  return `CO${String(nextCodeNum).padStart(3, '0')}`;
}
