import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const regions = [
    { id: 'us-east-1', name: 'US East (N. Virginia)', flag: '🇺🇸' },
    { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)', flag: '🇮🇳' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
    { id: 'eu-west-1', name: 'Europe (Ireland)', flag: '🇬🇧' },
    { id: 'eu-central-1', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: { id: region.id },
      update: { name: region.name, flag: region.flag },
      create: region
    });
    console.log(`✅ Region seeded: ${region.flag} ${region.name}`);
  }
  console.log('All regions seeded!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
