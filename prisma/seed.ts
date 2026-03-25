import { PrismaClient } from "@prisma/client";
import { ACHIEVEMENTS } from "../lib/achievements";
import { loadWordsFromPublicCsv } from "../utils/server-vocab-loader";

const prisma = new PrismaClient();

async function main() {
  const words = await loadWordsFromPublicCsv();

  for (const item of words) {
    await prisma.word.upsert({
      where: { word: item.word },
      create: item,
      update: {
        definition: item.definition,
        exampleSentence: item.exampleSentence,
        sourceGroup: item.sourceGroup ?? null
      }
    });
  }

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      create: achievement,
      update: {
        title: achievement.title,
        description: achievement.description,
        points: achievement.points
      }
    });
  }

  console.log(`Seeded ${words.length} words and ${ACHIEVEMENTS.length} achievements.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
